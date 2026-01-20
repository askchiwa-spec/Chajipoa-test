const axios = require('axios');
const logger = require('../config/logger');

class SMSService {
  constructor() {
    this.apiKey = process.env.SMS_API_KEY;
    this.senderId = process.env.SMS_SENDER_ID || 'CHAJIPOA';
    this.apiUrl = process.env.SMS_API_URL || 'https://api.smsprovider.com';
    
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      response => {
        logger.info('SMS API Success:', {
          status: response.status,
          recipient: response.config?.data?.to
        });
        return response;
      },
      error => {
        logger.error('SMS API Error:', {
          status: error.response?.status,
          message: error.message,
          recipient: error.config?.data?.to
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send SMS message
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - Message content
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendSMS(phoneNumber, message, options = {}) {
    try {
      const payload = {
        to: phoneNumber,
        from: this.senderId,
        message: message,
        type: options.type || 'text',
        callback_url: options.callbackUrl || null
      };

      const response = await this.axiosInstance.post('/sms/send', payload);
      
      logger.info('SMS sent successfully', {
        phoneNumber,
        messageId: response.data.message_id,
        status: response.data.status
      });

      return {
        success: true,
        messageId: response.data.message_id,
        status: response.data.status,
        providerResponse: response.data
      };
    } catch (error) {
      logger.error('SMS sending failed:', {
        phoneNumber,
        error: error.message,
        response: error.response?.data
      });
      
      throw new Error(`SMS sending failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} otp - OTP code
   * @returns {Promise<Object>} Send result
   */
  async sendOTP(phoneNumber, otp) {
    try {
      const message = `ChajiPoa Verification Code: ${otp}. Valid for 10 minutes. Do not share this code.`;
      
      return await this.sendSMS(phoneNumber, message, {
        type: 'otp'
      });
    } catch (error) {
      logger.error('OTP SMS sending failed:', error);
      throw error;
    }
  }

  /**
   * Send rental confirmation
   * @param {string} phoneNumber - Recipient phone number
   * @param {Object} rentalData - Rental information
   * @returns {Promise<Object>} Send result
   */
  async sendRentalConfirmation(phoneNumber, rentalData) {
    try {
      const {
        rentalCode,
        deviceCode,
        stationName,
        startTime,
        expectedEndTime,
        amount
      } = rentalData;

      const message = `✅ ChajiPoa Rental Confirmed!\n` +
                     `Rental Code: ${rentalCode}\n` +
                     `Device: ${deviceCode}\n` +
                     `Location: ${stationName}\n` +
                     `Start Time: ${new Date(startTime).toLocaleString()}\n` +
                     `Expected Return: ${new Date(expectedEndTime).toLocaleString()}\n` +
                     `Amount: TZS ${amount.toFixed(2)}\n` +
                     `Return to any ChajiPoa station`;

      return await this.sendSMS(phoneNumber, message);
    } catch (error) {
      logger.error('Rental confirmation SMS failed:', error);
      throw error;
    }
  }

  /**
   * Send overdue reminder
   * @param {string} phoneNumber - Recipient phone number
   * @param {Object} rentalData - Rental information
   * @returns {Promise<Object>} Send result
   */
  async sendOverdueReminder(phoneNumber, rentalData) {
    try {
      const {
        rentalCode,
        deviceCode,
        hoursOverdue,
        lateFee
      } = rentalData;

      const message = `⏰ ChajiPoa Overdue Reminder\n` +
                     `Rental: ${rentalCode}\n` +
                     `Device: ${deviceCode}\n` +
                     `Overdue by: ${hoursOverdue} hours\n` +
                     `Late Fee: TZS ${lateFee.toFixed(2)}\n` +
                     `Please return device immediately to avoid higher charges`;

      return await this.sendSMS(phoneNumber, message, {
        type: 'notification'
      });
    } catch (error) {
      logger.error('Overdue reminder SMS failed:', error);
      throw error;
    }
  }

  /**
   * Send payment confirmation
   * @param {string} phoneNumber - Recipient phone number
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Send result
   */
  async sendPaymentConfirmation(phoneNumber, paymentData) {
    try {
      const {
        transactionCode,
        amount,
        paymentMethod,
        rentalCode
      } = paymentData;

      const message = `💰 Payment Confirmed\n` +
                     `Transaction: ${transactionCode}\n` +
                     `Amount: TZS ${amount.toFixed(2)}\n` +
                     `Method: ${paymentMethod}\n` +
                     `Rental: ${rentalCode}\n` +
                     `Thank you for using ChajiPoa!`;

      return await this.sendSMS(phoneNumber, message);
    } catch (error) {
      logger.error('Payment confirmation SMS failed:', error);
      throw error;
    }
  }

  /**
   * Send maintenance alert
   * @param {string} phoneNumber - Recipient phone number
   * @param {Object} maintenanceData - Maintenance information
   * @returns {Promise<Object>} Send result
   */
  async sendMaintenanceAlert(phoneNumber, maintenanceData) {
    try {
      const {
        deviceCode,
        stationName,
        maintenanceType,
        estimatedDuration
      } = maintenanceData;

      const message = `🔧 Maintenance Alert\n` +
                     `Device: ${deviceCode}\n` +
                     `Station: ${stationName}\n` +
                     `Type: ${maintenanceType}\n` +
                     `Estimated Duration: ${estimatedDuration}\n` +
                     `We apologize for any inconvenience`;

      return await this.sendSMS(phoneNumber, message, {
        type: 'alert'
      });
    } catch (error) {
      logger.error('Maintenance alert SMS failed:', error);
      throw error;
    }
  }

  /**
   * Bulk SMS sending
   * @param {Array} recipients - Array of {phoneNumber, message} objects
   * @returns {Promise<Array>} Results for each recipient
   */
  async sendBulkSMS(recipients) {
    try {
      const results = [];
      
      for (const recipient of recipients) {
        try {
          const result = await this.sendSMS(
            recipient.phoneNumber, 
            recipient.message,
            recipient.options || {}
          );
          results.push({
            ...result,
            phoneNumber: recipient.phoneNumber,
            success: true
          });
        } catch (error) {
          results.push({
            phoneNumber: recipient.phoneNumber,
            success: false,
            error: error.message
          });
          logger.error(`Bulk SMS failed for ${recipient.phoneNumber}:`, error);
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      logger.info(`Bulk SMS completed: ${successCount}/${results.length} successful`);
      
      return results;
    } catch (error) {
      logger.error('Bulk SMS operation failed:', error);
      throw error;
    }
  }

  /**
   * Check SMS delivery status
   * @param {string} messageId - Message ID from send response
   * @returns {Promise<Object>} Delivery status
   */
  async checkDeliveryStatus(messageId) {
    try {
      const response = await this.axiosInstance.get(`/sms/status/${messageId}`);
      
      return {
        success: true,
        messageId,
        status: response.data.status,
        deliveredAt: response.data.delivered_at,
        providerResponse: response.data
      };
    } catch (error) {
      logger.error('Delivery status check failed:', error);
      throw new Error(`Delivery status check failed: ${error.message}`);
    }
  }
}

module.exports = new SMSService();