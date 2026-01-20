// src/routes/auth.routes.js
// Multi-Provider Authentication Routes

const express = require('express');
const router = express.Router();
const { AuthService } = require('../services/AuthService');
const rateLimit = require('express-rate-limit');

const authService = new AuthService();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
        error: 'Too many authentication attempts, please try again later.'
    }
});

// Phone Authentication Routes
router.post('/phone/send-otp', authLimiter, async (req, res, next) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }
        
        // Validate phone format
        const phoneRegex = /^(\+255|255|0)[67][0-9]{8}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Tanzanian phone number format'
            });
        }
        
        // Send OTP (integration with SMS service)
        // await SMSService.sendOTP(phone);
        
        res.json({
            success: true,
            message: 'OTP sent successfully',
            phone: phone.replace(/(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')
        });
        
    } catch (error) {
        next(error);
    }
});

router.post('/phone/verify', authLimiter, async (req, res, next) => {
    try {
        const { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP are required'
            });
        }
        
        const result = await authService.authenticate('phone', { phone, otp });
        
        res.json(result);
        
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// Email Authentication Routes
router.post('/email/register', authLimiter, async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        
        // Validate required fields
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and name are required'
            });
        }
        
        // Register user (this would save to database)
        // const user = await UserService.register({ email, password, name });
        
        res.json({
            success: true,
            message: 'User registered successfully',
            user: {
                email,
                name
            }
        });
        
    } catch (error) {
        next(error);
    }
});

router.post('/email/login', authLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        const result = await authService.authenticate('email', { email, password });
        
        res.json(result);
        
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// Social Authentication Routes
router.post('/social/facebook', authLimiter, async (req, res, next) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Access token is required'
            });
        }
        
        const result = await authService.authenticate('facebook', { accessToken });
        
        res.json(result);
        
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/social/apple', authLimiter, async (req, res, next) => {
    try {
        const { identityToken, fullName, email } = req.body;
        
        if (!identityToken) {
            return res.status(400).json({
                success: false,
                message: 'Identity token is required'
            });
        }
        
        const result = await authService.authenticate('apple', { 
            identityToken, 
            fullName, 
            email 
        });
        
        res.json(result);
        
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/social/google', authLimiter, async (req, res, next) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Access token is required'
            });
        }
        
        const result = await authService.authenticate('google', { accessToken });
        
        res.json(result);
        
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

// Token Management
router.post('/refresh', authLimiter, async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }
        
        // Verify and refresh token
        // const newToken = await authService.refreshToken(refreshToken);
        
        res.json({
            success: true,
            // token: newToken,
            message: 'Token refreshed successfully'
        });
        
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
});

router.post('/logout', async (req, res, next) => {
    try {
        const { token } = req.body;
        
        // Invalidate token (add to blacklist)
        // await authService.invalidateToken(token);
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        next(error);
    }
});

// User Profile
router.get('/profile', async (req, res, next) => {
    try {
        // This would require authentication middleware
        // const userId = req.user.userId;
        // const profile = await UserService.getProfile(userId);
        
        res.json({
            success: true,
            // profile: profile
            message: 'Profile retrieved successfully'
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;