const { postgresPool } = require('../config/database');
const redisClient = require('../config/redis');
const logger = require('../config/logger');
const { generateOTP, hashPassword, generateToken, formatPhoneNumber, validatePhoneNumber } = require('../utils/helpers');
const SMSService = require('../services/SMSService');
const { userSchemas } = require('../validators/schemas');
const AuditLog = require('../models/AuditLog');

class UserController {
  /**
   * Register new user
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async register(req, res, next) {
    try {
      const { phone_number, first_name, last_name, email, national_id } = req.validatedBody;
      
      // Format phone number
      const formattedPhone = formatPhoneNumber(phone_number);
      
      // Check if user already exists
      const existingUserQuery = 'SELECT id FROM users WHERE phone_number = $1';
      const existingUser = await postgresPool.query(existingUserQuery, [formattedPhone]);
      
      if (existingUser.rows.length > 0) {
        logger.warn('Registration attempt with existing phone number', { 
          phone_number: formattedPhone 
        });
        
        return res.status(409).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }

      // Generate OTP
      const otp = generateOTP();
      const otpHash = await hashPassword(otp);
      
      // Store OTP in Redis with 10-minute expiry
      const otpKey = `otp:${formattedPhone}`;
      await redisClient.client.setex(otpKey, 600, otpHash); // 10 minutes
      
      // Send OTP via SMS
      try {
        await SMSService.sendOTP(formattedPhone, otp);
        logger.info('OTP sent for registration', { phone_number: formattedPhone });
      } catch (smsError) {
        logger.error('Failed to send OTP SMS', { 
          phone_number: formattedPhone, 
          error: smsError.message 
        });
        // Don't fail registration if SMS fails, user can request OTP again
      }

      // Create temporary user record
      const insertQuery = `
        INSERT INTO users (phone_number, first_name, last_name, email, national_id, account_status)
        VALUES ($1, $2, $3, $4, $5, 'pending_verification')
        RETURNING id, phone_number, first_name, last_name, email, account_status, created_at
      `;
      
      const result = await postgresPool.query(insertQuery, [
        formattedPhone, 
        first_name, 
        last_name, 
        email, 
        national_id
      ]);

      const newUser = result.rows[0];

      // Log audit trail
      await AuditLog.create({
        action: 'USER_REGISTER',
        resourceType: 'user',
        resourceId: newUser.id,
        userId: newUser.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestData: { phone_number: formattedPhone, first_name, last_name },
        statusCode: 201,
        severity: 'INFO'
      });

      logger.info('User registration initiated', { 
        userId: newUser.id, 
        phone_number: formattedPhone 
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please verify your phone number.',
        data: {
          userId: newUser.id,
          phone_number: newUser.phone_number,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          account_status: newUser.account_status,
          otp_sent: true
        }
      });
    } catch (error) {
      logger.error('User registration failed:', error);
      next(error);
    }
  }

  /**
   * Verify phone number with OTP
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async verifyPhone(req, res, next) {
    try {
      const { phone_number, otp } = req.validatedBody;
      const formattedPhone = formatPhoneNumber(phone_number);

      // Get stored OTP hash
      const otpKey = `otp:${formattedPhone}`;
      const storedHash = await redisClient.client.get(otpKey);
      
      if (!storedHash) {
        return res.status(400).json({
          success: false,
          message: 'OTP expired or not found. Please request a new OTP.'
        });
      }

      // Verify OTP
      const isValid = await require('bcryptjs').compare(otp, storedHash);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP. Please try again.'
        });
      }

      // Update user status to active
      const updateQuery = `
        UPDATE users 
        SET account_status = 'active', last_login_at = NOW()
        WHERE phone_number = $1 AND account_status = 'pending_verification'
        RETURNING id, phone_number, first_name, last_name, account_status
      `;
      
      const result = await postgresPool.query(updateQuery, [formattedPhone]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found or already verified'
        });
      }

      const user = result.rows[0];

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        phone_number: user.phone_number,
        role: 'user'
      });

      // Clean up OTP
      await redisClient.client.del(otpKey);

      // Log audit trail
      await AuditLog.create({
        action: 'USER_LOGIN',
        resourceType: 'user',
        resourceId: user.id,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: 200,
        severity: 'INFO'
      });

      logger.info('User phone verification successful', { 
        userId: user.id, 
        phone_number: formattedPhone 
      });

      res.status(200).json({
        success: true,
        message: 'Phone number verified successfully',
        token,
        data: {
          user: {
            id: user.id,
            phone_number: user.phone_number,
            first_name: user.first_name,
            last_name: user.last_name,
            account_status: user.account_status
          }
        }
      });
    } catch (error) {
      logger.error('Phone verification failed:', error);
      next(error);
    }
  }

  /**
   * Resend OTP for verification
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async resendOTP(req, res, next) {
    try {
      const { phone_number } = req.validatedBody;
      const formattedPhone = formatPhoneNumber(phone_number);

      // Check if user exists and needs verification
      const userQuery = `
        SELECT id, first_name, last_name 
        FROM users 
        WHERE phone_number = $1 AND account_status = 'pending_verification'
      `;
      
      const userResult = await postgresPool.query(userQuery, [formattedPhone]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found or already verified'
        });
      }

      const user = userResult.rows[0];

      // Generate new OTP
      const otp = generateOTP();
      const otpHash = await hashPassword(otp);
      
      // Store new OTP
      const otpKey = `otp:${formattedPhone}`;
      await redisClient.client.setex(otpKey, 600, otpHash);

      // Send OTP via SMS
      try {
        await SMSService.sendOTP(formattedPhone, otp);
        logger.info('OTP resent successfully', { 
          userId: user.id, 
          phone_number: formattedPhone 
        });
      } catch (smsError) {
        logger.error('Failed to resend OTP SMS', { 
          userId: user.id, 
          phone_number: formattedPhone, 
          error: smsError.message 
        });
        return res.status(500).json({
          success: false,
          message: 'Failed to send OTP. Please try again later.'
        });
      }

      res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        data: {
          userId: user.id,
          phone_number: formattedPhone
        }
      });
    } catch (error) {
      logger.error('Resend OTP failed:', error);
      next(error);
    }
  }

  /**
   * Get user profile
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.user.userId;

      const query = `
        SELECT 
          id, phone_number, email, first_name, last_name, 
          user_type, account_status, deposit_balance, 
          total_rentals, total_spent, created_at, last_login_at
        FROM users 
        WHERE id = $1 AND account_status != 'deleted'
      `;
      
      const result = await postgresPool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = result.rows[0];

      logger.info('User profile retrieved', { userId });
      
      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            phone_number: user.phone_number,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            user_type: user.user_type,
            account_status: user.account_status,
            deposit_balance: parseFloat(user.deposit_balance),
            total_rentals: user.total_rentals,
            total_spent: parseFloat(user.total_spent),
            member_since: user.created_at,
            last_login: user.last_login_at
          }
        }
      });
    } catch (error) {
      logger.error('Get profile failed:', error);
      next(error);
    }
  }

  /**
   * Update user profile
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.userId;
      const { first_name, last_name, email, national_id } = req.validatedBody;

      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (first_name) {
        updates.push(`first_name = $${paramIndex}`);
        values.push(first_name);
        paramIndex++;
      }

      if (last_name) {
        updates.push(`last_name = $${paramIndex}`);
        values.push(last_name);
        paramIndex++;
      }

      if (email) {
        updates.push(`email = $${paramIndex}`);
        values.push(email);
        paramIndex++;
      }

      if (national_id) {
        updates.push(`national_id = $${paramIndex}`);
        values.push(national_id);
        paramIndex++;
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided for update'
        });
      }

      // Add user ID to values
      values.push(userId);
      
      const query = `
        UPDATE users 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex} AND account_status != 'deleted'
        RETURNING id, phone_number, email, first_name, last_name, user_type, account_status
      `;

      const result = await postgresPool.query(query, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const updatedUser = result.rows[0];

      // Log audit trail
      await AuditLog.create({
        action: 'USER_UPDATE',
        resourceType: 'user',
        resourceId: userId,
        userId: userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestData: req.validatedBody,
        statusCode: 200,
        severity: 'INFO'
      });

      logger.info('User profile updated', { userId });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: updatedUser.id,
            phone_number: updatedUser.phone_number,
            email: updatedUser.email,
            first_name: updatedUser.first_name,
            last_name: updatedUser.last_name,
            user_type: updatedUser.user_type,
            account_status: updatedUser.account_status
          }
        }
      });
    } catch (error) {
      logger.error('Update profile failed:', error);
      next(error);
    }
  }

  /**
   * Get user rental history
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getRentalHistory(req, res, next) {
    try {
      const userId = req.user.userId;
      const { limit = 20, offset = 0 } = req.query;

      const query = `
        SELECT 
          r.id, r.rental_code, r.device_id, r.station_from_id, r.station_to_id,
          r.rental_status, r.start_time, r.end_time, r.total_amount,
          d.device_code,
          s_from.name as station_from_name,
          s_to.name as station_to_name
        FROM rentals r
        LEFT JOIN devices d ON r.device_id = d.id
        LEFT JOIN stations s_from ON r.station_from_id = s_from.id
        LEFT JOIN stations s_to ON r.station_to_id = s_to.id
        WHERE r.user_id = $1
        ORDER BY r.start_time DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await postgresPool.query(query, [userId, parseInt(limit), parseInt(offset)]);

      // Get total count
      const countQuery = 'SELECT COUNT(*) as total FROM rentals WHERE user_id = $1';
      const countResult = await postgresPool.query(countQuery, [userId]);
      const totalCount = parseInt(countResult.rows[0].total);

      logger.info('User rental history retrieved', { userId, count: result.rows.length });

      res.status(200).json({
        success: true,
        data: {
          rentals: result.rows,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            pages: Math.ceil(totalCount / parseInt(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get rental history failed:', error);
      next(error);
    }
  }
}

module.exports = new UserController();