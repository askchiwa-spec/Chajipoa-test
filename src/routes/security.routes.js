// src/routes/security.routes.js
// Security Monitoring and Management Routes

const express = require('express');
const router = express.Router();
const securityMiddleware = require('../middleware/security.middleware');
const securityLogger = require('../utils/security.logger');
const { authenticateJWT } = require('../middleware/auth.middleware');

// Apply security middleware
router.use(securityMiddleware.securityHeaders());

// Security dashboard (admin only)
router.get('/dashboard', 
    authenticateJWT,
    securityMiddleware.secureJWT({ maxAge: '5m' }), // Short-lived token required
    async (req, res, next) => {
        try {
            if (!req.user.roles.includes('admin')) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Admin privileges required',
                    code: 'INSUFFICIENT_PRIVILEGES'
                });
            }
            
            // Get security statistics
            const stats = await securityLogger.getStats('24h');
            
            res.json({
                success: true,
                data: {
                    stats: stats,
                    activeThreats: [],
                    recentViolations: [],
                    systemHealth: 'operational'
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Security violations endpoint
router.get('/violations', 
    authenticateJWT,
    securityMiddleware.secureJWT({ maxAge: '5m' }),
    async (req, res, next) => {
        try {
            if (!req.user.roles.includes('admin') && !req.user.roles.includes('security')) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Security privileges required',
                    code: 'INSUFFICIENT_PRIVILEGES'
                });
            }
            
            const { limit = 50, offset = 0, severity, type } = req.query;
            
            // Query security violations (would connect to security database)
            const violations = await getSecurityViolations({
                limit: parseInt(limit),
                offset: parseInt(offset),
                severity,
                type
            });
            
            res.json({
                success: true,
                data: violations,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: violations.length
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Block IP address
router.post('/block-ip', 
    authenticateJWT,
    securityMiddleware.secureJWT({ maxAge: '5m' }),
    async (req, res, next) => {
        try {
            if (!req.user.roles.includes('admin')) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Admin privileges required',
                    code: 'INSUFFICIENT_PRIVILEGES'
                });
            }
            
            const { ip, reason, duration } = req.body;
            
            if (!ip) {
                return res.status(400).json({
                    error: 'Missing required field',
                    message: 'IP address is required',
                    code: 'MISSING_IP'
                });
            }
            
            // Add IP to blocked list in Redis
            const blockKey = `blocked-ip:${ip}`;
            const blockDuration = duration || 3600; // Default 1 hour
            
            await securityMiddleware.redisClient.setex(
                blockKey,
                blockDuration,
                JSON.stringify({
                    reason: reason || 'Manual block by admin',
                    blockedBy: req.user.userId,
                    timestamp: new Date().toISOString(),
                    duration: blockDuration
                })
            );
            
            // Log the block action
            securityLogger.logSystemEvent('IP_BLOCKED', {
                ip: ip,
                reason: reason,
                duration: blockDuration,
                blockedBy: req.user.userId
            });
            
            res.json({
                success: true,
                message: `IP ${ip} blocked successfully`,
                data: {
                    ip: ip,
                    blockedUntil: new Date(Date.now() + blockDuration * 1000).toISOString()
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Unblock IP address
router.delete('/block-ip/:ip', 
    authenticateJWT,
    securityMiddleware.secureJWT({ maxAge: '5m' }),
    async (req, res, next) => {
        try {
            if (!req.user.roles.includes('admin')) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Admin privileges required',
                    code: 'INSUFFICIENT_PRIVILEGES'
                });
            }
            
            const { ip } = req.params;
            
            // Remove IP from blocked list
            const blockKey = `blocked-ip:${ip}`;
            const result = await securityMiddleware.redisClient.del(blockKey);
            
            if (result === 0) {
                return res.status(404).json({
                    error: 'Not found',
                    message: 'IP address not found in block list',
                    code: 'IP_NOT_BLOCKED'
                });
            }
            
            // Log the unblock action
            securityLogger.logSystemEvent('IP_UNBLOCKED', {
                ip: ip,
                unblockedBy: req.user.userId,
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                message: `IP ${ip} unblocked successfully`
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Revoke JWT token
router.post('/revoke-token', 
    authenticateJWT,
    securityMiddleware.secureJWT({ maxAge: '5m' }),
    async (req, res, next) => {
        try {
            if (!req.user.roles.includes('admin')) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Admin privileges required',
                    code: 'INSUFFICIENT_PRIVILEGES'
                });
            }
            
            const { token, reason } = req.body;
            
            if (!token) {
                return res.status(400).json({
                    error: 'Missing required field',
                    message: 'Token is required',
                    code: 'MISSING_TOKEN'
                });
            }
            
            // Add token to blacklist
            const blacklistKey = `jwt:blacklist:${token}`;
            await securityMiddleware.redisClient.setex(
                blacklistKey,
                86400, // 24 hours
                JSON.stringify({
                    reason: reason || 'Manual revocation',
                    revokedBy: req.user.userId,
                    timestamp: new Date().toISOString()
                })
            );
            
            // Log the revocation
            securityLogger.logSystemEvent('TOKEN_REVOKED', {
                token: token.substring(0, 20) + '...',
                reason: reason,
                revokedBy: req.user.userId
            });
            
            res.json({
                success: true,
                message: 'Token revoked successfully'
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Security audit logs
router.get('/audit-logs', 
    authenticateJWT,
    securityMiddleware.secureJWT({ maxAge: '5m' }),
    async (req, res, next) => {
        try {
            if (!req.user.roles.includes('admin') && !req.user.roles.includes('auditor')) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Audit privileges required',
                    code: 'INSUFFICIENT_PRIVILEGES'
                });
            }
            
            const { startDate, endDate, limit = 100 } = req.query;
            
            // Export security logs
            const logs = securityLogger.exportLogs(
                startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                endDate || new Date().toISOString(),
                'json'
            );
            
            res.json({
                success: true,
                data: logs
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Check if IP is blocked
router.get('/check-ip/:ip', async (req, res, next) => {
    try {
        const { ip } = req.params;
        const blockKey = `blocked-ip:${ip}`;
        const blockData = await securityMiddleware.redisClient.get(blockKey);
        
        res.json({
            success: true,
            data: {
                ip: ip,
                isBlocked: !!blockData,
                blockInfo: blockData ? JSON.parse(blockData) : null
            }
        });
        
    } catch (error) {
        next(error);
    }
});

// Security configuration endpoint
router.get('/config', 
    authenticateJWT,
    securityMiddleware.secureJWT({ maxAge: '5m' }),
    async (req, res, next) => {
        try {
            if (!req.user.roles.includes('admin')) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Admin privileges required',
                    code: 'INSUFFICIENT_PRIVILEGES'
                });
            }
            
            res.json({
                success: true,
                data: {
                    rateLimits: {
                        default: { windowMs: 900000, max: 100 },
                        strict: { windowMs: 900000, max: 10 },
                        lenient: { windowMs: 900000, max: 1000 }
                    },
                    securityHeaders: {
                        'X-Content-Type-Options': 'nosniff',
                        'X-Frame-Options': 'DENY',
                        'X-XSS-Protection': '1; mode=block',
                        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
                    },
                    jwtConfig: {
                        algorithm: 'HS256',
                        maxAge: '24h',
                        issuer: 'chajipoa-auth'
                    }
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
);

// Helper function to simulate getting security violations
async function getSecurityViolations(options) {
    // This would query a security database or log aggregation system
    // For now, returning mock data
    return [
        {
            id: 'sec_001',
            type: 'RATE_LIMIT_EXCEEDED',
            severity: 'low',
            ip: '192.168.1.100',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            details: { path: '/api/auth/login', count: 150 }
        }
    ].slice(options.offset, options.offset + options.limit);
}

module.exports = router;