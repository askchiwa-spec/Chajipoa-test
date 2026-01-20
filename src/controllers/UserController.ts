import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import logger from '../config/logger';
import { CreateUserDTO } from '../models/User';

const userService = new UserService();

export class UserController {
  async register(req: Request, res: Response): Promise<any> {
    try {
      const userData: CreateUserDTO = req.body;

      // Validate required fields
      if (!userData.phone_number) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      // Validate Tanzanian phone number format
      const phoneRegex = /^(?:\+255|0)[67]\d{8}$/;
      if (!phoneRegex.test(userData.phone_number)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Tanzanian phone number format'
        });
      }

      const user = await userService.create(userData);

      // Generate OTP for verification
      const otp = await userService.generateOTP(user.phone_number);

      // In production, send OTP via SMS
      logger.info(`OTP for ${user.phone_number}: ${otp}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. OTP sent for verification.',
        data: {
          user: {
            id: user.id,
            phone_number: user.phone_number,
            user_type: user.user_type
          },
          otpSent: true
        }
      });
    } catch (error: any) {
      logger.error('Registration error:', error);
      
      if (error.message === 'User already exists') {
        return res.status(409).json({
          success: false,
          error: 'User with this phone number already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async verifyOTP(req: Request, res: Response): Promise<any> {
    try {
      const { phone_number, otp } = req.body;

      if (!phone_number || !otp) {
        return res.status(400).json({
          success: false,
          error: 'Phone number and OTP are required'
        });
      }

      const isValid = await userService.verifyOTP(phone_number, otp);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired OTP'
        });
      }

      // Get user and generate token
      const user = await userService.findByPhone(phone_number);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const token = await userService.generateToken(user);

      // Update last login
      await userService.update(user.id, {});

      res.json({
        success: true,
        message: 'OTP verified successfully',
        data: {
          token,
          user: {
            id: user.id,
            phone_number: user.phone_number,
            first_name: user.first_name,
            last_name: user.last_name,
            user_type: user.user_type,
            deposit_balance: user.deposit_balance
          }
        }
      });
    } catch (error) {
      logger.error('OTP verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getProfile(req: Request, res: Response): Promise<any> {
    try {
      const userId = (req as any).user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const user = await userService.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Remove sensitive data
      const { password_hash, otp_code, otp_expires_at, ...userData } = user;

      res.json({
        success: true,
        data: userData
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async addDeposit(req: Request, res: Response): Promise<any> {
    try {
      const userId = (req as any).user?.userId;
      const { amount } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid deposit amount is required'
        });
      }

      const user = await userService.updateDeposit(userId, amount);

      res.json({
        success: true,
        message: `Deposit of TZS ${amount} added successfully`,
        data: {
          new_balance: user.deposit_balance
        }
      });
    } catch (error) {
      logger.error('Add deposit error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}