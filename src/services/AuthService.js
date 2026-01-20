// src/services/AuthService.js
// Multi-Provider Authentication Service

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');
const jwksClient = require('jwks-rsa');
const { logger } = require('../utils/logger');

class AuthService {
    constructor() {
        this.providers = {
            phone: PhoneAuthProvider,
            facebook: FacebookAuthProvider,
            apple: AppleAuthProvider,
            google: GoogleAuthProvider,
            email: EmailAuthProvider
        };
        
        this.jwtSecret = process.env.JWT_SECRET;
        this.tokenExpiry = process.env.JWT_EXPIRY || '24h';
    }
    
    async authenticate(provider, credentials) {
        const authProvider = this.providers[provider];
        
        if (!authProvider) {
            throw new Error(`Unsupported provider: ${provider}`);
        }
        
        try {
            // Validate credentials
            const validationResult = await this.validateCredentials(provider, credentials);
            
            if (!validationResult.valid) {
                throw new Error(`Invalid credentials: ${validationResult.error}`);
            }
            
            // Authenticate with provider
            const authResult = await authProvider.authenticate(credentials);
            
            // Create or update user in database
            const user = await this.syncUserWithProvider(authResult, provider);
            
            // Generate JWT token
            const token = this.generateToken(user);
            
            // Log authentication
            await this.auditLog(user.id, provider, 'login');
            
            return {
                success: true,
                token,
                user: this.sanitizeUser(user),
                provider
            };
            
        } catch (error) {
            logger.error('Authentication failed', {
                provider,
                error: error.message,
                stack: error.stack
            });
            
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }
    
    generateToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            phone: user.phone,
            provider: user.provider,
            roles: user.roles || ['user']
        };
        
        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.tokenExpiry,
            issuer: 'chajipoa-auth',
            subject: user.id.toString()
        });
    }
    
    async validateCredentials(provider, credentials) {
        switch (provider) {
            case 'phone':
                return this.validatePhoneCredentials(credentials);
            case 'email':
                return this.validateEmailCredentials(credentials);
            case 'facebook':
            case 'google':
            case 'apple':
                return this.validateOAuthCredentials(credentials);
            default:
                return { valid: false, error: 'Invalid provider' };
        }
    }
    
    async validatePhoneCredentials(credentials) {
        const { phone, otp } = credentials;
        
        if (!phone || !otp) {
            return { valid: false, error: 'Phone and OTP are required' };
        }
        
        // Validate phone format (Tanzanian format)
        const phoneRegex = /^(\+255|255|0)[67][0-9]{8}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            return { valid: false, error: 'Invalid Tanzanian phone number format' };
        }
        
        // Validate OTP format
        if (!/^\d{6}$/.test(otp)) {
            return { valid: false, error: 'OTP must be 6 digits' };
        }
        
        return { valid: true };
    }
    
    async validateEmailCredentials(credentials) {
        const { email, password } = credentials;
        
        if (!email || !password) {
            return { valid: false, error: 'Email and password are required' };
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: 'Invalid email format' };
        }
        
        // Validate password strength
        if (password.length < 8) {
            return { valid: false, error: 'Password must be at least 8 characters' };
        }
        
        return { valid: true };
    }
    
    async validateOAuthCredentials(credentials) {
        const { accessToken } = credentials;
        
        if (!accessToken) {
            return { valid: false, error: 'Access token is required' };
        }
        
        return { valid: true };
    }
    
    async syncUserWithProvider(authResult, provider) {
        // This would interact with your database
        // Implementation depends on your database setup
        const user = {
            id: authResult.providerId,
            email: authResult.email,
            name: authResult.name,
            phone: authResult.phone,
            avatar: authResult.avatar,
            provider: provider,
            providerId: authResult.providerId,
            metadata: authResult.metadata,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: new Date()
        };
        
        // Save to database (pseudo-code)
        // await User.upsert(user);
        
        return user;
    }
    
    sanitizeUser(user) {
        const { password, ...safeUser } = user;
        return safeUser;
    }
    
    async auditLog(userId, provider, action) {
        // Log authentication events
        logger.info('Authentication event', {
            userId,
            provider,
            action,
            timestamp: new Date().toISOString()
        });
        
        // Save to audit log database
        // await AuditLog.create({ userId, provider, action, timestamp: new Date() });
    }
}

// Facebook Authentication Provider
class FacebookAuthProvider {
    static async authenticate(credentials) {
        const { accessToken } = credentials;
        
        try {
            // Verify Facebook token and get user info
            const fbResponse = await axios.get(
                `https://graph.facebook.com/v18.0/me`,
                {
                    params: {
                        access_token: accessToken,
                        fields: 'id,name,email,picture.width(400).height(400)'
                    }
                }
            );
            
            return {
                provider: 'facebook',
                providerId: fbResponse.data.id,
                email: fbResponse.data.email,
                name: fbResponse.data.name,
                avatar: fbResponse.data.picture?.data?.url,
                metadata: {
                    ...fbResponse.data,
                    accessToken
                }
            };
            
        } catch (error) {
            throw new Error('Facebook authentication failed: ' + error.message);
        }
    }
}

// Apple ID Authentication Provider
class AppleAuthProvider {
    static async authenticate(credentials) {
        const { identityToken, fullName, email } = credentials;
        
        try {
            // Verify Apple JWT token
            const appleJWT = await this.verifyAppleJWT(identityToken);
            
            return {
                provider: 'apple',
                providerId: appleJWT.sub,
                email: appleJWT.email || email,
                name: fullName || appleJWT.email?.split('@')[0] || 'Apple User',
                metadata: {
                    isPrivateEmail: appleJWT.is_private_email || false,
                    identityToken
                }
            };
            
        } catch (error) {
            throw new Error('Apple authentication failed: ' + error.message);
        }
    }
    
    static async verifyAppleJWT(identityToken) {
        const client = jwksClient({
            jwksUri: 'https://appleid.apple.com/auth/keys'
        });
        
        const decoded = jwt.decode(identityToken, { complete: true });
        const kid = decoded.header.kid;
        
        const key = await new Promise((resolve, reject) => {
            client.getSigningKey(kid, (err, key) => {
                if (err) reject(err);
                else resolve(key);
            });
        });
        
        const signingKey = key.getPublicKey();
        
        return jwt.verify(identityToken, signingKey, {
            algorithms: ['RS256'],
            audience: process.env.APPLE_CLIENT_ID,
            issuer: 'https://appleid.apple.com'
        });
    }
}

// Google Authentication Provider
class GoogleAuthProvider {
    static async authenticate(credentials) {
        const { accessToken } = credentials;
        
        try {
            // Verify Google token and get user info
            const googleResponse = await axios.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            );
            
            const userData = googleResponse.data;
            
            return {
                provider: 'google',
                providerId: userData.sub,
                email: userData.email,
                name: userData.name,
                avatar: userData.picture,
                metadata: {
                    ...userData,
                    accessToken
                }
            };
            
        } catch (error) {
            throw new Error('Google authentication failed: ' + error.message);
        }
    }
}

// Phone Authentication Provider
class PhoneAuthProvider {
    static async authenticate(credentials) {
        const { phone, otp } = credentials;
        
        try {
            // Verify OTP (this would integrate with your SMS service)
            const isValid = await this.verifyOTP(phone, otp);
            
            if (!isValid) {
                throw new Error('Invalid OTP');
            }
            
            return {
                provider: 'phone',
                providerId: phone,
                phone: phone,
                name: `User ${phone.slice(-4)}`, // Last 4 digits as name
                metadata: {
                    phone,
                    verified: true
                }
            };
            
        } catch (error) {
            throw new Error('Phone authentication failed: ' + error.message);
        }
    }
    
    static async verifyOTP(phone, otp) {
        // This would integrate with your OTP verification service
        // For demo purposes, accepting a test OTP
        if (otp === '123456') {
            return true;
        }
        
        // In real implementation:
        // return await SMSService.verifyOTP(phone, otp);
        return false;
    }
}

// Email Authentication Provider
class EmailAuthProvider {
    static async authenticate(credentials) {
        const { email, password } = credentials;
        
        try {
            // Verify email/password combination
            // This would check against your database
            const user = await this.findUserByEmail(email);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            
            if (!isValidPassword) {
                throw new Error('Invalid password');
            }
            
            return {
                provider: 'email',
                providerId: user.id,
                email: user.email,
                name: user.name,
                metadata: {
                    email: user.email,
                    verified: user.emailVerified
                }
            };
            
        } catch (error) {
            throw new Error('Email authentication failed: ' + error.message);
        }
    }
    
    static async findUserByEmail(email) {
        // This would query your database
        // For demo purposes, returning mock user
        return {
            id: 'user_123',
            email: email,
            name: 'Demo User',
            passwordHash: await bcrypt.hash('demo_password', 12),
            emailVerified: true
        };
    }
}

module.exports = {
    AuthService,
    FacebookAuthProvider,
    AppleAuthProvider,
    GoogleAuthProvider,
    PhoneAuthProvider,
    EmailAuthProvider
};