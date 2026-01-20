// src/services/AzamPayService.js
// AzamPay Mobile Money Integration Service for Tanzania

const axios = require('axios');
const crypto = require('crypto');

class AzamPayService {
    constructor() {
        this.config = {
            sandbox: process.env.AZAMPAY_SANDBOX === 'true',
            baseUrl: process.env.AZAMPAY_SANDBOX === 'true' 
                ? 'https://sandbox.azampay.co.tz' 
                : 'https://api.azampay.co.tz',
            clientId: process.env.AZAMPAY_CLIENT_ID,
            clientSecret: process.env.AZAMPAY_CLIENT_SECRET,
            appName: process.env.AZAMPAY_APP_NAME,
            apiKey: process.env.AZAMPAY_API_KEY
        };
        
        this.accessToken = null;
        this.tokenExpiry = null;
    }
    
    // Get OAuth2 access token
    async getAccessToken() {
        // Return cached token if still valid
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }
        
        try {
            const response = await axios.post(`${this.config.baseUrl}/AppRegistration/GenerateToken`, {
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            if (response.data && response.data.data) {
                this.accessToken = response.data.data;
                // Token typically expires in 1 hour (3600 seconds)
                this.tokenExpiry = Date.now() + (55 * 60 * 1000); // Refresh after 55 minutes
                return this.accessToken;
            }
            
            throw new Error('Failed to obtain access token');
            
        } catch (error) {
            console.error('AzamPay token generation failed:', error.response?.data || error.message);
            throw new Error(`Token generation failed: ${error.response?.data?.message || error.message}`);
        }
    }
    
    // Mobile Money Checkout
    async mobileMoneyCheckout(paymentData) {
        try {
            const token = await this.getAccessToken();
            
            const payload = {
                appName: this.config.appName,
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret,
                amount: paymentData.amount,
                currency: paymentData.currency || 'TZS',
                externalId: paymentData.externalId || this.generateExternalId(),
                provider: paymentData.provider || 'Mpesa', // Mpesa, Tigo, Airtel, Halopesa
                mobile: paymentData.mobile.replace('+', ''), // Remove + prefix
                redirectFailURL: paymentData.redirectFailURL || `${process.env.BASE_URL}/payment/failed`,
                redirectSuccessURL: paymentData.redirectSuccessURL || `${process.env.BASE_URL}/payment/success`,
                vendorId: this.config.apiKey,
                vendorName: this.config.appName
            };
            
            const response = await axios.post(`${this.config.baseUrl}/azampay/mmcheckout`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            return {
                success: true,
                data: response.data,
                transactionId: response.data?.transactionId || response.data?.data?.transactionId,
                redirectUrl: response.data?.redirectUrl || response.data?.data?.redirectUrl
            };
            
        } catch (error) {
            console.error('AzamPay mobile money checkout failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    // Bank Checkout
    async bankCheckout(paymentData) {
        try {
            const token = await this.getAccessToken();
            
            const payload = {
                appName: this.config.appName,
                amount: paymentData.amount,
                currency: paymentData.currency || 'TZS',
                externalId: paymentData.externalId || this.generateExternalId(),
                bankName: paymentData.bankName || 'CRDB', // CRDB, NMB
                accountNumber: paymentData.accountNumber,
                redirectFailURL: paymentData.redirectFailURL || `${process.env.BASE_URL}/payment/failed`,
                redirectSuccessURL: paymentData.redirectSuccessURL || `${process.env.BASE_URL}/payment/success`
            };
            
            const response = await axios.post(`${this.config.baseUrl}/azampay/bankcheckout`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            return {
                success: true,
                data: response.data,
                transactionId: response.data?.transactionId
            };
            
        } catch (error) {
            console.error('AzamPay bank checkout failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message,
                statusCode: error.response?.status
            };
        }
    }
    
    // Get payment partners/providers
    async getPaymentPartners() {
        try {
            const token = await this.getAccessToken();
            
            const response = await axios.get(`${this.config.baseUrl}/azampay/partners`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            
            return {
                success: true,
                data: response.data
            };
            
        } catch (error) {
            console.error('Failed to fetch payment partners:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
    
    // Request payment link
    async requestPaymentLink(paymentData) {
        try {
            const token = await this.getAccessToken();
            
            const payload = {
                amount: paymentData.amount,
                currency: paymentData.currency || 'TZS',
                externalId: paymentData.externalId || this.generateExternalId(),
                redirectFailURL: paymentData.redirectFailURL || `${process.env.BASE_URL}/payment/failed`,
                redirectSuccessURL: paymentData.redirectSuccessURL || `${process.env.BASE_URL}/payment/success`,
                buyerEmail: paymentData.buyerEmail,
                buyerName: paymentData.buyerName,
                buyerPhonenumber: paymentData.buyerPhonenumber,
                cartItems: paymentData.cartItems || []
            };
            
            const response = await axios.post(`${this.config.baseUrl}/azampay/requestpaymentlink`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            return {
                success: true,
                data: response.data,
                paymentLink: response.data?.paymentLink
            };
            
        } catch (error) {
            console.error('Payment link request failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
    
    // Verify transaction status
    async verifyTransaction(transactionId) {
        try {
            const token = await this.getAccessToken();
            
            const response = await axios.get(`${this.config.baseUrl}/azampay/transaction/${transactionId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            
            return {
                success: true,
                data: response.data,
                status: response.data?.status || response.data?.data?.status
            };
            
        } catch (error) {
            console.error('Transaction verification failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
    
    // Handle webhook callbacks
    async handleWebhook(payload, signature) {
        try {
            // Verify webhook signature if provided
            if (signature) {
                const isValid = this.verifyWebhookSignature(payload, signature);
                if (!isValid) {
                    throw new Error('Invalid webhook signature');
                }
            }
            
            // Process the webhook data
            const transactionData = payload;
            
            // Update transaction status in your database
            await this.updateTransactionStatus(transactionData);
            
            return {
                success: true,
                processed: true,
                transactionId: transactionData.transactionId
            };
            
        } catch (error) {
            console.error('Webhook processing failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Generate external ID for transactions
    generateExternalId() {
        return `CHAJI_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Verify webhook signature (implementation depends on AzamPay's method)
    verifyWebhookSignature(payload, signature) {
        // This is a placeholder - actual implementation depends on AzamPay's signature method
        // Could be HMAC SHA256, RSA signature, etc.
        try {
            const expectedSignature = crypto
                .createHmac('sha256', this.config.apiKey)
                .update(JSON.stringify(payload))
                .digest('hex');
                
            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }
    
    // Update transaction status in database
    async updateTransactionStatus(transactionData) {
        // This would integrate with your database
        // Example implementation:
        /*
        await Transaction.update({
            status: transactionData.status,
            updatedAt: new Date(),
            providerReference: transactionData.providerReference,
            completedAt: transactionData.completedAt ? new Date(transactionData.completedAt) : null
        }, {
            where: {
                transactionId: transactionData.transactionId
            }
        });
        */
        console.log('Updating transaction status:', transactionData);
    }
    
    // Test connection to AzamPay API
    async testConnection() {
        try {
            const token = await this.getAccessToken();
            return {
                success: true,
                message: 'Successfully connected to AzamPay API',
                tokenObtained: !!token
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Get supported providers
    getSupportedProviders() {
        return [
            { name: 'Mpesa', code: 'Mpesa', country: 'TZ' },
            { name: 'Tigo Pesa', code: 'Tigo', country: 'TZ' },
            { name: 'Airtel Money', code: 'Airtel', country: 'TZ' },
            { name: 'Halopesa', code: 'Halopesa', country: 'TZ' },
            { name: 'CRDB Bank', code: 'CRDB', country: 'TZ' },
            { name: 'NMB Bank', code: 'NMB', country: 'TZ' }
        ];
    }
}

module.exports = new AzamPayService();