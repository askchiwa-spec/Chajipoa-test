// config/security.config.js
// Security Configuration Settings

module.exports = {
    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
        issuer: 'chajipoa-auth',
        audience: 'chajipoa-users',
        algorithm: 'HS256'
    },
    
    // Rate Limiting Configuration
    rateLimiting: {
        // Default rate limits
        default: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 requests per window
            message: 'Too many requests, please try again later',
            standardHeaders: true,
            legacyHeaders: false
        },
        
        // Strict rate limits for sensitive endpoints
        strict: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 10, // Only 10 requests per window
            message: 'Rate limit exceeded for sensitive operation',
            skipSuccessfulRequests: false
        },
        
        // Lenient rate limits for public endpoints
        lenient: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 1000, // 1000 requests per window
            message: 'Rate limit exceeded',
            skipFailedRequests: true
        },
        
        // Authentication rate limits
        auth: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // Only 5 auth attempts per window
            message: 'Too many authentication attempts',
            skipSuccessfulRequests: true
        }
    },
    
    // Security Headers
    securityHeaders: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    },
    
    // CORS Configuration
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [
            'https://chajipoa.co.tz',
            'https://admin.chajipoa.co.tz',
            'https://app.chajipoa.co.tz'
        ],
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin'
        ]
    },
    
    // Input Validation Rules
    validation: {
        // Phone number validation (Tanzanian format)
        phone: {
            pattern: /^(\+255|255|0)[67][0-9]{8}$/,
            message: 'Invalid Tanzanian phone number format'
        },
        
        // Email validation
        email: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Invalid email format'
        },
        
        // Password requirements
        password: {
            minLength: 8,
            maxLength: 128,
            requireNumbers: true,
            requireSpecialChars: true,
            message: 'Password must be 8-128 characters with numbers and special characters'
        },
        
        // NIDA number validation
        nida: {
            pattern: /^[0-9]{20}$/,
            message: 'Invalid NIDA number format'
        }
    },
    
    // Session Management
    session: {
        redisPrefix: 'user-session:',
        ttl: 24 * 60 * 60, // 24 hours in seconds
        refreshThreshold: 5 * 60, // Refresh if less than 5 minutes remaining
        maxSessionsPerUser: 5
    },
    
    // Blacklist/Whitelist Configuration
    ipFiltering: {
        // Whitelisted IPs (empty array means no whitelisting)
        whitelist: process.env.IP_WHITELIST?.split(',') || [],
        
        // Blacklisted IPs
        blacklist: process.env.IP_BLACKLIST?.split(',') || [],
        
        // Auto-block settings
        autoBlock: {
            enabled: true,
            threshold: 100, // Number of violations before auto-blocking
            duration: 3600, // Duration in seconds (1 hour)
            violationWindow: 3600 // Window to count violations (1 hour)
        }
    },
    
    // Security Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        securityLevel: 'warn',
        auditTrail: true,
        logFile: 'logs/security.log',
        rotation: {
            maxSize: '100m',
            maxFiles: 10,
            compress: true
        }
    },
    
    // Threat Detection
    threatDetection: {
        enabled: true,
        // Suspicious patterns to monitor
        patterns: {
            sqlInjection: true,
            xss: true,
            pathTraversal: true,
            commandInjection: true,
            bruteForce: true
        },
        
        // Alert thresholds
        alerts: {
            rateLimitViolations: 50,
            maliciousInputs: 10,
            failedAuthAttempts: 20,
            suspiciousIPs: 5
        }
    },
    
    // Encryption Settings
    encryption: {
        // For sensitive data at rest
        dataAtRest: {
            algorithm: 'aes-256-gcm',
            keyLength: 32
        },
        
        // For data in transit (TLS settings)
        dataInTransit: {
            minVersion: 'TLSv1.2',
            ciphers: [
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES256-GCM-SHA384'
            ]
        }
    },
    
    // Two-Factor Authentication
    twoFactor: {
        enabled: process.env.TWO_FACTOR_ENABLED === 'true',
        issuer: 'ChajiPoa',
        window: 1, // 1 minute window for TOTP
        backupCodes: 10, // Number of backup codes to generate
        smsEnabled: true,
        emailEnabled: true
    },
    
    // Password Policy
    passwordPolicy: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 90, // Days before password expires
        history: 5, // Number of previous passwords to remember
        lockout: {
            attempts: 5,
            duration: 30 // Minutes
        }
    },
    
    // API Security
    apiSecurity: {
        // API key requirements
        apiKey: {
            required: process.env.API_KEY_REQUIRED === 'true',
            headerName: 'X-API-Key',
            minLength: 32
        },
        
        // Request size limits
        requestLimits: {
            json: '10mb',
            form: '10mb',
            file: '50mb'
        },
        
        // Timeout settings
        timeouts: {
            request: 30000, // 30 seconds
            socket: 60000   // 60 seconds
        }
    }
};