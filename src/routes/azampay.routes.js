// src/routes/azampay.routes.js
// AzamPay API Integration Routes

const express = require('express');
const router = express.Router();
const AzamPayService = require('../services/AzamPayService');
const { authenticateJWT } = require('../middleware/auth.middleware');
const securityMiddleware = require('../middleware/security.middleware');

// Apply security middleware
router.use(securityMiddleware.securityHeaders());

// Test AzamPay connection
router.get('/test-connection', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const result = await AzamPayService.testConnection();
            
            res.json({
                success: true,
                data: result
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Get supported payment providers
router.get('/providers', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const providers = AzamPayService.getSupportedProviders();
            
            res.json({
                success: true,
                data: {
                    providers: providers,
                    count: providers.length
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Get payment partners
router.get('/partners', 
    authenticateJWT,
    securityMiddleware.rateLimiter({ max: 50 }),
    async (req, res, next) => {
        try {
            const result = await AzamPayService.getPaymentPartners();
            
            res.json(result);
            
        } catch (error) {
            next(error);
        }
    }
);

// Mobile Money Checkout
router.post('/mobile-money/checkout', 
    authenticateJWT,
    securityMiddleware.validateRequest(require('../schemas/payment.schema')),
    securityMiddleware.rateLimiter({ max: 20 }),
    async (req, res, next) => {
        try {
            const paymentData = req.body;
            
            // Validate required fields
            if (!paymentData.amount || !paymentData.mobile || !paymentData.provider) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: amount, mobile, provider'
                });
            }
            
            // Validate mobile number format (Tanzanian format)
            const phoneRegex = /^(\+255|255|0)[67][0-9]{8}$/;
            if (!phoneRegex.test(paymentData.mobile)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid Tanzanian mobile number format'
                });
            }
            
            // Validate amount
            if (paymentData.amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Amount must be greater than 0'
                });
            }
            
            const result = await AzamPayService.mobileMoneyCheckout(paymentData);
            
            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: 'Payment initiated successfully',
                    data: result.data,
                    transactionId: result.transactionId,
                    redirectUrl: result.redirectUrl
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    statusCode: result.statusCode
                });
            }
            
        } catch (error) {
            next(error);
        }
    }
);

// Bank Checkout
router.post('/bank/checkout', 
    authenticateJWT,
    securityMiddleware.validateRequest(require('../schemas/bank-payment.schema')),
    securityMiddleware.rateLimiter({ max: 20 }),
    async (req, res, next) => {
        try {
            const paymentData = req.body;
            
            // Validate required fields
            if (!paymentData.amount || !paymentData.accountNumber || !paymentData.bankName) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: amount, accountNumber, bankName'
                });
            }
            
            const result = await AzamPayService.bankCheckout(paymentData);
            
            res.json(result);
            
        } catch (error) {
            next(error);
        }
    }
);

// Request Payment Link
router.post('/payment-link', 
    authenticateJWT,
    securityMiddleware.validateRequest(require('../schemas/payment-link.schema')),
    securityMiddleware.rateLimiter({ max: 30 }),
    async (req, res, next) => {
        try {
            const paymentData = req.body;
            
            const result = await AzamPayService.requestPaymentLink(paymentData);
            
            if (result.success) {
                res.status(201).json({
                    success: true,
                    message: 'Payment link generated successfully',
                    data: result.data,
                    paymentLink: result.paymentLink
                });
            } else {
                res.status(400).json(result);
            }
            
        } catch (error) {
            next(error);
        }
    }
);

// Verify Transaction Status
router.get('/transaction/:transactionId', 
    authenticateJWT,
    securityMiddleware.rateLimiter({ max: 100 }),
    async (req, res, next) => {
        try {
            const { transactionId } = req.params;
            
            if (!transactionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Transaction ID is required'
                });
            }
            
            const result = await AzamPayService.verifyTransaction(transactionId);
            
            res.json(result);
            
        } catch (error) {
            next(error);
        }
    }
);

// Webhook endpoint for AzamPay callbacks
router.post('/webhook', 
    express.raw({ type: 'application/json' }),
    async (req, res, next) => {
        try {
            // Get signature from headers
            const signature = req.headers['x-azampay-signature'] || req.headers['signature'];
            
            // Parse raw body for signature verification
            let payload;
            try {
                payload = JSON.parse(req.body.toString());
            } catch (parseError) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid JSON payload'
                });
            }
            
            const result = await AzamPayService.handleWebhook(payload, signature);
            
            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: 'Webhook processed successfully',
                    processed: result.processed
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('Webhook processing error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error processing webhook'
            });
        }
    }
);

// Bulk payment processing
router.post('/bulk-payments', 
    authenticateJWT,
    securityMiddleware.rateLimiter({ max: 5 }),
    async (req, res, next) => {
        try {
            const { payments } = req.body;
            
            if (!Array.isArray(payments) || payments.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Payments array is required and cannot be empty'
                });
            }
            
            if (payments.length > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 100 payments per request'
                });
            }
            
            const results = [];
            
            // Process payments sequentially to avoid rate limiting
            for (const payment of payments) {
                try {
                    const result = await AzamPayService.mobileMoneyCheckout(payment);
                    results.push({
                        ...payment,
                        success: result.success,
                        transactionId: result.transactionId,
                        error: result.success ? null : result.error
                    });
                } catch (error) {
                    results.push({
                        ...payment,
                        success: false,
                        error: error.message
                    });
                }
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            res.json({
                success: true,
                data: {
                    results: results,
                    summary: {
                        total: results.length,
                        successful: successful,
                        failed: failed,
                        successRate: ((successful / results.length) * 100).toFixed(2) + '%'
                    }
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Payment status polling endpoint
router.get('/poll-status/:transactionId', 
    authenticateJWT,
    async (req, res, next) => {
        try {
            const { transactionId } = req.params;
            const { maxAttempts = 10, interval = 3000 } = req.query;
            
            let attempts = 0;
            let result;
            
            while (attempts < parseInt(maxAttempts)) {
                result = await AzamPayService.verifyTransaction(transactionId);
                
                // If transaction is completed (success or failed), return immediately
                if (result.success && ['SUCCESS', 'FAILED', 'CANCELLED'].includes(result.status?.toUpperCase())) {
                    return res.json({
                        success: true,
                        data: result.data,
                        finalStatus: result.status,
                        attempts: attempts + 1
                    });
                }
                
                attempts++;
                
                // Wait before next poll
                if (attempts < parseInt(maxAttempts)) {
                    await new Promise(resolve => setTimeout(resolve, parseInt(interval)));
                }
            }
            
            // Return last known status
            res.json({
                success: true,
                data: result?.data || null,
                status: result?.status || 'PENDING',
                attempts: attempts,
                message: 'Maximum polling attempts reached'
            });
            
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;