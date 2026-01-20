// src/utils/security.logger.js
// Security Event Logging System

const winston = require('winston');
const { format } = winston;

class SecurityLogger {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: format.combine(
                format.timestamp(),
                format.errors({ stack: true }),
                format.json()
            ),
            defaultMeta: { service: 'chajipoa-security' },
            transports: [
                // Security events file
                new winston.transports.File({
                    filename: 'logs/security-events.log',
                    level: 'warn',
                    format: format.combine(
                        format.timestamp(),
                        format.json()
                    )
                }),
                
                // Critical security alerts
                new winston.transports.File({
                    filename: 'logs/security-critical.log',
                    level: 'error',
                    format: format.combine(
                        format.timestamp(),
                        format.json()
                    )
                }),
                
                // Console output for development
                new winston.transports.Console({
                    format: format.combine(
                        format.colorize(),
                        format.simple()
                    )
                })
            ]
        });
    }
    
    // Log security violations
    logViolation(type, details) {
        const logEntry = {
            type: type,
            severity: this.getSeverity(type),
            details: details,
            timestamp: new Date().toISOString()
        };
        
        this.logger.warn('SECURITY_VIOLATION', logEntry);
        
        // Send alert for critical violations
        if (this.isCritical(type)) {
            this.sendAlert(logEntry);
        }
        
        return logEntry;
    }
    
    // Log authentication events
    logAuthEvent(userId, eventType, details = {}) {
        const logEntry = {
            type: 'AUTH_EVENT',
            eventType: eventType,
            userId: userId,
            details: details,
            timestamp: new Date().toISOString()
        };
        
        this.logger.info('AUTHENTICATION', logEntry);
        return logEntry;
    }
    
    // Log suspicious activities
    logSuspiciousActivity(activityType, details) {
        const logEntry = {
            type: 'SUSPICIOUS_ACTIVITY',
            activityType: activityType,
            severity: 'medium',
            details: details,
            timestamp: new Date().toISOString()
        };
        
        this.logger.warn('SUSPICIOUS_ACTIVITY', logEntry);
        return logEntry;
    }
    
    // Log system security events
    logSystemEvent(eventType, details) {
        const logEntry = {
            type: 'SYSTEM_SECURITY',
            eventType: eventType,
            details: details,
            timestamp: new Date().toISOString()
        };
        
        this.logger.info('SYSTEM_SECURITY', logEntry);
        return logEntry;
    }
    
    // Get severity level for violation type
    getSeverity(violationType) {
        const severityMap = {
            'RATE_LIMIT_EXCEEDED': 'low',
            'MALICIOUS_INPUT_DETECTED': 'high',
            'TOKEN_REVOKED': 'medium',
            'UNAUTHORIZED_ACCESS': 'high',
            'INVALID_CREDENTIALS': 'medium',
            'SESSION_HIJACKING': 'critical',
            'BRUTE_FORCE_ATTEMPT': 'critical',
            'SQL_INJECTION_ATTEMPT': 'critical',
            'XSS_ATTEMPT': 'high'
        };
        
        return severityMap[violationType] || 'medium';
    }
    
    // Check if violation is critical
    isCritical(violationType) {
        const criticalTypes = [
            'SESSION_HIJACKING',
            'BRUTE_FORCE_ATTEMPT',
            'SQL_INJECTION_ATTEMPT'
        ];
        
        return criticalTypes.includes(violationType);
    }
    
    // Send security alerts (could integrate with Slack, email, etc.)
    sendAlert(alertData) {
        // In production, this would send alerts to security team
        console.error('🚨 CRITICAL SECURITY ALERT:', JSON.stringify(alertData, null, 2));
        
        // Example integration points:
        // - Send to Slack webhook
        // - Send email to security team
        // - Trigger incident response system
        // - Integrate with SIEM system
    }
    
    // Get security statistics
    async getStats(timeframe = '24h') {
        // This would query the security logs to generate statistics
        // For now, returning mock data
        return {
            totalViolations: 0,
            criticalAlerts: 0,
            suspiciousActivities: 0,
            timeframe: timeframe,
            topViolations: []
        };
    }
    
    // Export security logs
    exportLogs(startDate, endDate, format = 'json') {
        // This would export logs for analysis
        // Implementation would depend on log storage system
        return {
            exported: true,
            format: format,
            startDate: startDate,
            endDate: endDate
        };
    }
}

module.exports = new SecurityLogger();