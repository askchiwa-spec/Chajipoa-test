// src/middleware/security.middleware.js
// Enhanced Security Middleware for ChajiPoa Platform

const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const redis = require('redis');
const { logger } = require('../utils/logger');

class SecurityMiddleware {
    constructor() {
        this.redisClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        this.redisClient.on('error', (err) => {
            logger.error('Redis Client Error', err);
        });
        
        this.redisClient.connect().catch(console.error);
    }
    
    // 1. Advanced Rate Limiting with Redis
    rateLimiter(options = {}) {
        const config = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: options.max || 100, // requests per windowMs
            standardHeaders: true,
            legacyHeaders: false,
            ...options
        };
        
        return rateLimit({
            windowMs: config.windowMs,
            max: config.max,
            standardHeaders: config.standardHeaders,
            legacyHeaders: config.legacyHeaders,
            
            // Enhanced key generation
            keyGenerator: (req) => {
                // Use IP + user agent + path for granular control
                const userAgent = req.headers['user-agent'] || 'unknown';
                const path = req.path.split('/')[1] || 'root'; // First path segment
                return `rate-limit:${req.ip}:${path}:${userAgent.substring(0, 50)}`;
            },
            
            // Smart skipping logic
            skip: (req) => {
                // Skip for health checks, webhooks, and authenticated users with premium plans
                const skipPaths = ['/health', '/webhook', '/metrics'];
                const isSkippablePath = skipPaths.some(path => 
                    req.path.startsWith(path)
                );
                
                // Skip for authenticated premium users
                const isPremiumUser = req.user?.plan === 'premium';
                
                return isSkippablePath || isPremiumUser;
            },
            
            // Custom handler with enhanced logging
            handler: (req, res) => {
                const clientInfo = {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    path: req.path,
                    method: req.method,
                    timestamp: new Date().toISOString()
                };
                
                // Log rate limit violation
                logger.warn('Rate limit exceeded', clientInfo);
                
                // Store violation in Redis for analytics
                this.storeRateLimitViolation(clientInfo);
                
                // Return enhanced error response
                res.status(429).json({
                    error: 'Too many requests',
                    message: 'Rate limit exceeded. Please try again later.',
                    retryAfter: Math.ceil(config.windowMs / 1000), // seconds
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            }
        });
    }
    
    // 2. Request Validation Middleware
    validateRequest(schema) {
        return async (req, res, next) => {
            try {
                // Validate request body
                const validatedData = await schema.validateAsync(req.body, {
                    abortEarly: false, // Return all errors
                    stripUnknown: true, // Remove unknown properties
                    presence: 'required' // Require all defined fields
                });
                
                // Sanitize input to prevent XSS and injection
                req.body = this.sanitizeInput(validatedData);
                
                // Check for malicious patterns
                const maliciousPatterns = this.containsMaliciousPattern(req.body);
                if (maliciousPatterns) {
                    const securityEvent = {
                        type: 'MALICIOUS_INPUT_DETECTED',
                        ip: req.ip,
                        userAgent: req.headers['user-agent'],
                        patterns: maliciousPatterns,
                        timestamp: new Date().toISOString()
                    };
                    
                    logger.warn('Malicious pattern detected', securityEvent);
                    this.logSecurityEvent(securityEvent);
                    
                    return res.status(400).json({
                        error: 'Invalid input detected',
                        message: 'Request contains unsafe content',
                        code: 'MALICIOUS_INPUT'
                    });
                }
                
                // Log validation success for audit trail
                logger.debug('Request validation successful', {
                    path: req.path,
                    method: req.method,
                    userId: req.user?.id
                });
                
                next();
                
            } catch (error) {
                logger.warn('Request validation failed', {
                    error: error.message,
                    details: error.details,
                    path: req.path,
                    ip: req.ip
                });
                
                res.status(400).json({
                    error: 'Validation failed',
                    message: 'Invalid request data',
                    details: error.details?.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    })) || [{ message: error.message }],
                    code: 'VALIDATION_ERROR'
                });
            }
        };
    }
    
    // 3. Enhanced JWT Security Middleware
    secureJWT(options = {}) {
        return async (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({
                    error: 'No token provided',
                    message: 'Authentication required',
                    code: 'MISSING_TOKEN'
                });
            }
            
            try {
                // Check token in blacklist (revoked tokens)
                const isBlacklisted = await this.redisClient.get(`jwt:blacklist:${token}`);
                if (isBlacklisted) {
                    logger.warn('Attempt to use blacklisted token', {
                        token: token.substring(0, 20) + '...',
                        ip: req.ip,
                        userAgent: req.headers['user-agent']
                    });
                    
                    return res.status(401).json({
                        error: 'Token revoked',
                        message: 'This token has been invalidated',
                        code: 'TOKEN_REVOKED'
                    });
                }
                
                // Verify JWT token
                const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                    algorithms: ['HS256'],
                    maxAge: options.maxAge || '24h',
                    issuer: 'chajipoa-auth'
                });
                
                // Enhanced token freshness check for sensitive operations
                const sensitivePaths = ['/security', '/payment', '/admin', '/transfer'];
                const isSensitiveOperation = sensitivePaths.some(path => 
                    req.path.includes(path)
                );
                
                if (isSensitiveOperation) {
                    const tokenAge = Date.now() - (decoded.iat * 1000);
                    const maxTokenAge = options.sensitiveMaxAge || 5 * 60 * 1000; // 5 minutes
                    
                    if (tokenAge > maxTokenAge) {
                        logger.warn('Token too old for sensitive operation', {
                            userId: decoded.userId,
                            path: req.path,
                            tokenAge: tokenAge / 1000 + 's'
                        });
                        
                        return res.status(401).json({
                            error: 'Token too old for this operation',
                            message: 'Please refresh your authentication token',
                            code: 'TOKEN_REFRESH_REQUIRED',
                            refreshUrl: '/api/auth/refresh'
                        });
                    }
                }
                
                // Check user session validity
                const sessionValid = await this.validateUserSession(decoded.userId, token);
                if (!sessionValid) {
                    return res.status(401).json({
                        error: 'Invalid session',
                        message: 'User session not found or expired',
                        code: 'INVALID_SESSION'
                    });
                }
                
                // Attach user info to request
                req.user = {
                    ...decoded,
                    token: token
                };
                
                // Log successful authentication
                logger.debug('Token validation successful', {
                    userId: decoded.userId,
                    path: req.path,
                    method: req.method
                });
                
                next();
                
            } catch (error) {
                let errorCode = 'INVALID_TOKEN';
                let statusCode = 401;
                let message = 'Invalid authentication token';
                
                if (error.name === 'TokenExpiredError') {
                    errorCode = 'TOKEN_EXPIRED';
                    message = 'Authentication token has expired';
                } else if (error.name === 'JsonWebTokenError') {
                    errorCode = 'TOKEN_MALFORMED';
                    message = 'Authentication token is malformed';
                }
                
                logger.warn('JWT verification failed', {
                    error: error.name,
                    message: error.message,
                    ip: req.ip,
                    path: req.path
                });
                
                res.status(statusCode).json({
                    error: error.name,
                    message: message,
                    code: errorCode
                });
            }
        };
    }
    
    // 4. Input Sanitization
    sanitizeInput(input) {
        if (typeof input === 'string') {
            return input
                .trim()
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
                .replace(/javascript:/gi, '') // Remove javascript: protocol
                .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
                .replace(/on\w+='[^']*'/gi, '') // Remove event handlers (single quotes)
                .replace(/[<>]/g, ''); // Remove angle brackets
        }
        
        if (typeof input === 'object' && input !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitizeInput(value);
            }
            return sanitized;
        }
        
        return input;
    }
    
    // 5. Malicious Pattern Detection
    containsMaliciousPattern(data) {
        const patterns = [
            {
                name: 'SQL_INJECTION',
                regex: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)|(--|#|\/\*)/i
            },
            {
                name: 'XSS_SCRIPT',
                regex: /(<script|javascript:|on\w+=)/i
            },
            {
                name: 'PATH_TRAVERSAL',
                regex: /(\.\.\/|\.\.\\)/
            },
            {
                name: 'COMMAND_INJECTION',
                regex: /(&&|\|\||;|`|\$\(|\${)/
            }
        ];
        
        const detectedPatterns = [];
        
        const searchData = (obj, path = '') => {
            if (typeof obj === 'string') {
                patterns.forEach(pattern => {
                    if (pattern.regex.test(obj)) {
                        detectedPatterns.push({
                            pattern: pattern.name,
                            value: obj,
                            path: path
                        });
                    }
                });
            } else if (typeof obj === 'object' && obj !== null) {
                Object.keys(obj).forEach(key => {
                    searchData(obj[key], path ? `${path}.${key}` : key);
                });
            }
        };
        
        searchData(data);
        return detectedPatterns.length > 0 ? detectedPatterns : null;
    }
    
    // 6. Helper Methods
    async storeRateLimitViolation(violationData) {
        try {
            const key = `rate-limit-violation:${violationData.ip}:${Date.now()}`;
            await this.redisClient.setex(
                key,
                3600, // 1 hour expiry
                JSON.stringify(violationData)
            );
            
            // Increment violation counter
            const counterKey = `rate-limit-count:${violationData.ip}`;
            await this.redisClient.incr(counterKey);
            await this.redisClient.expire(counterKey, 86400); // 24 hours
        } catch (error) {
            logger.error('Failed to store rate limit violation', error);
        }
    }
    
    async logSecurityEvent(event) {
        try {
            const key = `security-event:${event.type}:${Date.now()}`;
            await this.redisClient.setex(
                key,
                86400, // 24 hours expiry
                JSON.stringify(event)
            );
        } catch (error) {
            logger.error('Failed to log security event', error);
        }
    }
    
    async validateUserSession(userId, token) {
        try {
            const sessionKey = `user-session:${userId}`;
            const storedToken = await this.redisClient.get(sessionKey);
            
            return storedToken === token;
        } catch (error) {
            logger.error('Session validation failed', { userId, error });
            return false;
        }
    }
    
    // 7. Security Headers Middleware
    securityHeaders() {
        return (req, res, next) => {
            // Security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            res.setHeader('Content-Security-Policy', "default-src 'self'");
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            
            // Remove server information
            res.removeHeader('X-Powered-By');
            
            next();
        };
    }
    
    // 8. IP Whitelisting Middleware
    ipWhitelist(allowedIPs = []) {
        return (req, res, next) => {
            const clientIP = req.ip;
            
            if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
                logger.warn('Unauthorized IP access attempt', {
                    ip: clientIP,
                    path: req.path,
                    userAgent: req.headers['user-agent']
                });
                
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Your IP address is not authorized',
                    code: 'IP_NOT_AUTHORIZED'
                });
            }
            
            next();
        };
    }
}

module.exports = new SecurityMiddleware();