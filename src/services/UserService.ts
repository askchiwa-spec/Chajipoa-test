import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { User, CreateUserDTO, UpdateUserDTO } from '../models/User';
import logger from '../config/logger';
import redis from '../config/redis';

export class UserService {
  async create(userData: CreateUserDTO): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await this.findByPhone(userData.phone_number);
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password if provided
      let passwordHash: string | null = null;
      if (userData.password) {
        passwordHash = await bcrypt.hash(userData.password, 10);
      }

      const result = await query(
        `INSERT INTO users (
          phone_number, national_id, email, first_name, 
          last_name, user_type, password_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          userData.phone_number,
          userData.national_id,
          userData.email,
          userData.first_name,
          userData.last_name,
          userData.user_type || 'regular',
          passwordHash
        ]
      );

      logger.info(`User created: ${userData.phone_number}`);
      return result.rows[0];
    } catch (error) {
      logger.error('User creation error:', error);
      throw error;
    }
  }

  async findByPhone(phoneNumber: string): Promise<User | null> {
    try {
      const result = await query(
        'SELECT * FROM users WHERE phone_number = $1',
        [phoneNumber]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find user by phone error:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const result = await query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find user by ID error:', error);
      throw error;
    }
  }

  async update(id: string, userData: UpdateUserDTO): Promise<User> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (userData.email) {
        fields.push(`email = $${paramCount}`);
        values.push(userData.email);
        paramCount++;
      }
      if (userData.first_name) {
        fields.push(`first_name = $${paramCount}`);
        values.push(userData.first_name);
        paramCount++;
      }
      if (userData.last_name) {
        fields.push(`last_name = $${paramCount}`);
        values.push(userData.last_name);
        paramCount++;
      }
      if (userData.user_type) {
        fields.push(`user_type = $${paramCount}`);
        values.push(userData.user_type);
        paramCount++;
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const queryStr = `
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await query(queryStr, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Update user error:', error);
      throw error;
    }
  }

  async generateOTP(phoneNumber: string): Promise<string> {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await query(
        'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE phone_number = $3',
        [otp, expiresAt, phoneNumber]
      );

      // Store in Redis for fast verification
      await redis.setex(`otp:${phoneNumber}`, 600, otp); // 10 minutes TTL

      logger.info(`OTP generated for: ${phoneNumber}`);
      return otp;
    } catch (error) {
      logger.error('Generate OTP error:', error);
      throw error;
    }
  }

  async verifyOTP(phoneNumber: string, otp: string): Promise<boolean> {
    try {
      // First check Redis cache
      const cachedOTP = await redis.get(`otp:${phoneNumber}`);
      if (cachedOTP === otp) {
        await redis.del(`otp:${phoneNumber}`);
        return true;
      }

      // Fallback to database
      const result = await query(
        'SELECT otp_code, otp_expires_at FROM users WHERE phone_number = $1',
        [phoneNumber]
      );

      if (!result.rows[0]) return false;

      const { otp_code, otp_expires_at } = result.rows[0];
      
      if (otp_code === otp && new Date(otp_expires_at) > new Date()) {
        // Clear OTP after successful verification
        await query(
          'UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE phone_number = $1',
          [phoneNumber]
        );
        
        await redis.del(`otp:${phoneNumber}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Verify OTP error:', error);
      throw error;
    }
  }

  async generateToken(user: User): Promise<string> {
    const payload = {
      userId: user.id,
      phone: user.phone_number,
      userType: user.user_type
    };

    return jwt.sign(payload, process.env['JWT_SECRET']!, {
      expiresIn: '24h'
    });
  }

  async updateDeposit(userId: string, amount: number): Promise<User> {
    try {
      const result = await query(
        `UPDATE users 
         SET deposit_balance = deposit_balance + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [amount, userId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Update deposit error:', error);
      throw error;
    }
  }
}