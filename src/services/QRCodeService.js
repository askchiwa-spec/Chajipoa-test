const QRCode = require('qrcode');
const crypto = require('crypto');
const logger = require('../config/logger');
const redisClient = require('../config/redis');
const { generateRandomString } = require('../utils/helpers');

class QRCodeService {
  constructor() {
    this.sessionExpiry = 300; // 5 minutes in seconds
    this.qrOptions = {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };
  }

  /**
   * Generate dynamic QR code for rental
   * @param {Object} rentalData - Rental information
   * @returns {Promise<Object>} QR code data
   */
  async generateRentalQR(rentalData) {
    try {
      const {
        deviceId,
        stationId,
        userId,
        rentalType = 'standard' // standard, premium, tourist
      } = rentalData;

      // Generate unique session ID
      const sessionId = generateRandomString(32);
      
      // Create QR data payload
      const qrPayload = {
        sessionId,
        deviceId,
        stationId,
        userId,
        rentalType,
        timestamp: Date.now(),
        expiry: Date.now() + (this.sessionExpiry * 1000)
      };

      // Generate QR code
      const qrData = JSON.stringify(qrPayload);
      const qrImageUrl = await QRCode.toDataURL(qrData, this.qrOptions);
      
      // Store session in Redis
      const sessionKey = `qr_session:${sessionId}`;
      await redisClient.client.setex(sessionKey, this.sessionExpiry, JSON.stringify(qrPayload));

      // Log QR generation
      logger.info('QR code generated', {
        sessionId,
        deviceId,
        stationId,
        userId
      });

      return {
        success: true,
        sessionId,
        qrImageUrl,
        payload: qrPayload,
        expiry: this.sessionExpiry
      };
    } catch (error) {
      logger.error('QR code generation failed:', error);
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  }

  /**
   * Validate QR code session
   * @param {string} sessionId - QR session ID
   * @param {Object} scanData - Scan data for validation
   * @returns {Promise<Object>} Validation result
   */
  async validateQRSession(sessionId, scanData = {}) {
    try {
      const sessionKey = `qr_session:${sessionId}`;
      const sessionData = await redisClient.client.get(sessionKey);
      
      if (!sessionData) {
        return {
          success: false,
          message: 'QR code session expired or invalid',
          code: 'SESSION_EXPIRED'
        };
      }

      const parsedSession = JSON.parse(sessionData);
      
      // Check if session is expired
      if (Date.now() > parsedSession.expiry) {
        // Clean up expired session
        await redisClient.client.del(sessionKey);
        return {
          success: false,
          message: 'QR code session has expired',
          code: 'SESSION_EXPIRED'
        };
      }

      // Validate device and station match (if provided)
      if (scanData.deviceId && parsedSession.deviceId !== scanData.deviceId) {
        return {
          success: false,
          message: 'Device mismatch',
          code: 'DEVICE_MISMATCH'
        };
      }

      if (scanData.stationId && parsedSession.stationId !== scanData.stationId) {
        return {
          success: false,
          message: 'Station mismatch',
          code: 'STATION_MISMATCH'
        };
      }

      // Update session activity
      await redisClient.client.expire(sessionKey, this.sessionExpiry);

      return {
        success: true,
        message: 'QR code validated successfully',
        session: parsedSession
      };
    } catch (error) {
      logger.error('QR session validation failed:', error);
      throw new Error(`QR validation failed: ${error.message}`);
    }
  }

  /**
   * Process QR code scan
   * @param {string} qrData - Scanned QR code data
   * @param {Object} context - Scan context (user, location, etc.)
   * @returns {Promise<Object>} Scan result
   */
  async processQRScan(qrData, context = {}) {
    try {
      let parsedData;
      
      // Try to parse as JSON first
      try {
        parsedData = JSON.parse(qrData);
      } catch (parseError) {
        // If not JSON, treat as session ID
        parsedData = { sessionId: qrData };
      }

      // Validate session
      const validationResult = await this.validateQRSession(parsedData.sessionId, {
        deviceId: context.deviceId,
        stationId: context.stationId
      });

      if (!validationResult.success) {
        return validationResult;
      }

      // Process the rental action based on rental type
      const session = validationResult.session;
      
      logger.info('QR scan processed successfully', {
        sessionId: session.sessionId,
        userId: session.userId,
        deviceId: session.deviceId,
        rentalType: session.rentalType
      });

      return {
        success: true,
        message: 'QR scan processed successfully',
        action: this.determineAction(session.rentalType),
        session,
        context
      };
    } catch (error) {
      logger.error('QR scan processing failed:', error);
      throw new Error(`QR scan processing failed: ${error.message}`);
    }
  }

  /**
   * Determine action based on rental type
   * @param {string} rentalType - Type of rental
   * @returns {string} Action to perform
   */
  determineAction(rentalType) {
    const actions = {
      'standard': 'START_RENTAL',
      'premium': 'START_PREMIUM_RENTAL',
      'tourist': 'START_TOURIST_RENTAL',
      'return': 'RETURN_DEVICE'
    };
    
    return actions[rentalType] || 'START_RENTAL';
  }

  /**
   * Invalidate QR session
   * @param {string} sessionId - Session ID to invalidate
   * @returns {Promise<boolean>} Success status
   */
  async invalidateSession(sessionId) {
    try {
      const sessionKey = `qr_session:${sessionId}`;
      const result = await redisClient.client.del(sessionKey);
      
      logger.info('QR session invalidated', { sessionId });
      return result > 0;
    } catch (error) {
      logger.error('Failed to invalidate QR session:', error);
      return false;
    }
  }

  /**
   * Get active sessions count
   * @returns {Promise<number>} Active sessions count
   */
  async getActiveSessionsCount() {
    try {
      const keys = await redisClient.client.keys('qr_session:*');
      return keys.length;
    } catch (error) {
      logger.error('Failed to get active sessions count:', error);
      return 0;
    }
  }

  /**
   * Cleanup expired sessions
   * @returns {Promise<void>}
   */
  async cleanupExpiredSessions() {
    try {
      const keys = await redisClient.client.keys('qr_session:*');
      let cleanedCount = 0;
      
      for (const key of keys) {
        const sessionData = await redisClient.client.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (Date.now() > session.expiry) {
            await redisClient.client.del(key);
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired QR sessions`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
    }
  }
}

module.exports = new QRCodeService();