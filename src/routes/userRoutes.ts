import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate, validate, apiLimiter } from '../middleware/auth';
import Joi from 'joi';

const router = Router();
const userController = new UserController();

// Validation schemas
const registerSchema = Joi.object({
  phone_number: Joi.string()
    .pattern(/^(?:\+255|0)[67]\d{8}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Tanzanian phone number format'
    }),
  national_id: Joi.string().optional(),
  email: Joi.string().email().optional(),
  first_name: Joi.string().min(2).max(100).optional(),
  last_name: Joi.string().min(2).max(100).optional(),
  user_type: Joi.string().valid('regular', 'tourist', 'corporate').optional(),
  password: Joi.string().min(6).optional()
});

const otpSchema = Joi.object({
  phone_number: Joi.string()
    .pattern(/^(?:\+255|0)[67]\d{8}$/)
    .required(),
  otp: Joi.string().length(6).required()
});

const depositSchema = Joi.object({
  amount: Joi.number().positive().required()
});

// Public routes
router.post('/register', apiLimiter, validate(registerSchema), userController.register);
router.post('/verify-otp', apiLimiter, validate(otpSchema), userController.verifyOTP);

// Protected routes (require authentication)
router.get('/profile', authenticate, userController.getProfile);
router.post('/deposit', authenticate, validate(depositSchema), userController.addDeposit);

// Admin routes (would require admin middleware)
// router.post('/:userId/blacklist', authenticate, adminOnly, userController.blacklistUser);

export default router;