import { Router } from 'express';
import { RentalController } from '../controllers/RentalController';
import { authenticate, validate, apiLimiter } from '../middleware/auth';
import Joi from 'joi';

const router = Router();
const rentalController = new RentalController();

// Validation schemas
const startRentalSchema = Joi.object({
  device_id: Joi.string().uuid().required(),
  station_from_id: Joi.string().uuid().required(),
  payment_method: Joi.string().valid('mpesa', 'tigopesa', 'airtelmoney', 'halopesa', 'card').default('mpesa'),
  qr_code: Joi.string().optional()
});

const completeRentalSchema = Joi.object({
  station_to_id: Joi.string().uuid().required(),
  total_hours: Joi.number().positive().required(),
  notes: Joi.string().optional()
});

const qrScanSchema = Joi.object({
  qr_code: Joi.string().required()
});

// Public routes (with rate limiting)
router.get('/devices/available', rentalController.getAvailableDevices);
router.get('/calculate-price', rentalController.calculatePrice);
router.post('/scan-qr', apiLimiter, validate(qrScanSchema), rentalController.scanQRCode);

// Protected routes (require authentication)
router.post('/start', authenticate, validate(startRentalSchema), rentalController.startRental);
router.post('/:rentalId/complete', authenticate, validate(completeRentalSchema), rentalController.completeRental);
router.get('/active', authenticate, rentalController.getActiveRental);
router.get('/history', authenticate, rentalController.getRentalHistory);

export default router;