const axios = require('axios');
const logger = require('../config/logger');
const { generateTransactionCode } = require('../utils/helpers');

class AzamPayService {
  constructor() {
    this.baseUrl = process.env.AZAMPAY_BASE_URL || 'https://api.azampay.co.tz';
    this.apiKey = process.env.AZAMPAY_API_KEY;
    this.merchantId = process.env.AZAMPAY_MERCHANT_ID;
    this.callbackUrl = process.env.AZAMPAY_CALLBACK_URL;
    this.webhookUrl = process.env.AZAMPAY_WEBHOOK_URL;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      response => {
        logger.info('AzamPay API Success:', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      error => {
        logger.error('AzamPay API Error:', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initiate mobile money payment
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment response
   */
  async initiatePayment(paymentData) {
    try {
      const {
        amount,
        currency = 'TZS',
        phoneNumber,
        provider, // mpesa, tigopesa, airtelmoney, halopesa
        accountNumber,
        externalId,
        additionalProperties = {}
      } = paymentData;

      const payload = {
        vendorId: this.merchantId,
        amount: amount.toString(),
        currency: currency,
        language: "sw", // Swahili
        externalId: externalId || generateTransactionCode('PAY'),
        customer: {
          phone: phoneNumber,
          email: additionalProperties.email || '',
          firstName: additionalProperties.firstName || '',
          lastName: additionalProperties.lastName || ''
        },
        provider: provider.toUpperCase(),
        accountNumber: accountNumber || phoneNumber,
        redirectFailURL: additionalProperties.redirectFailURL || '',
        redirectSuccessURL: additionalProperties.redirectSuccessURL || '',
        callbackURL: this.callbackUrl,
        buyerDetails: {
          name: `${additionalProperties.firstName || ''} ${additionalProperties.lastName || ''}`.trim(),
          phone: phoneNumber,
          email: additionalProperties.email || ''
        }
      };

      const response = await this.axiosInstance.post('/payments/mobilemoney', payload);
      
      return {
        success: true,
        data: response.data,
        transactionId: response.data.transactionId,
        message: 'Payment initiated successfully'
      };
    } catch (error) {
      logger.error('AzamPay payment initiation failed:', error);
      throw new Error(`Payment initiation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify payment status
   * @param {string} transactionId - Transaction ID from AzamPay
   * @returns {Promise<Object>} Payment status
   */
  async verifyPayment(transactionId) {
    try {
      const response = await this.axiosInstance.get(`/payments/status/${transactionId}`);
      
      return {
        success: true,
        data: response.data,
        status: response.data.status,
        message: 'Payment status retrieved successfully'
      };
    } catch (error) {
      logger.error('AzamPay payment verification failed:', error);
      throw new Error(`Payment verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Handle payment callback from AzamPay
   * @param {Object} callbackData - Callback data from AzamPay webhook
   * @returns {Promise<Object>} Processed callback response
   */
  async handleCallback(callbackData) {
    try {
      logger.info('Received AzamPay callback:', callbackData);
      
      // Validate callback data
      const requiredFields = ['transactionId', 'status', 'amount', 'currency'];
      const missingFields = requiredFields.filter(field => !callbackData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Process based on status
      switch (callbackData.status.toLowerCase()) {
        case 'success':
        case 'completed':
          // Payment successful - update transaction in database
          logger.info(`Payment successful for transaction ${callbackData.transactionId}`);
          break;
          
        case 'failed':
        case 'cancelled':
          // Payment failed - update transaction status
          logger.warn(`Payment failed for transaction ${callbackData.transactionId}`);
          break;
          
        case 'pending':
          // Payment pending - update status to pending
          logger.info(`Payment pending for transaction ${callbackData.transactionId}`);
          break;
          
        default:
          logger.warn(`Unknown payment status: ${callbackData.status}`);
      }

      return {
        success: true,
        message: 'Callback processed successfully',
        transactionId: callbackData.transactionId,
        status: callbackData.status
      };
    } catch (error) {
      logger.error('AzamPay callback processing failed:', error);
      throw new Error(`Callback processing failed: ${error.message}`);
    }
  }

  /**
   * Get supported providers
   * @returns {Promise<Array>} List of supported providers
   */
  async getSupportedProviders() {
    try {
      const response = await this.axiosInstance.get('/providers');
      return response.data;
    } catch (error) {
      logger.error('Failed to get supported providers:', error);
      throw new Error(`Failed to get providers: ${error.message}`);
    }
  }

  /**
   * Get transaction fees
   * @param {number} amount - Transaction amount
   * @param {string} provider - Payment provider
   * @returns {Promise<Object>} Fee information
   */
  async getTransactionFee(amount, provider) {
    try {
      const response = await this.axiosInstance.post('/fees', {
        amount: amount.toString(),
        provider: provider.toUpperCase()
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get transaction fee:', error);
      throw new Error(`Failed to get fee: ${error.message}`);
    }
  }
}

module.exports = new AzamPayService();