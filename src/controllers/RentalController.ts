import { Request, Response } from 'express';
import { RentalService } from '../services/RentalService';
import { DeviceService } from '../services/DeviceService';
import logger from '../config/logger';
import { CreateRentalDTO, CompleteRentalDTO } from '../models/Rental';

const rentalService = new RentalService();
const deviceService = new DeviceService();

export class RentalController {
  async startRental(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const rentalData: CreateRentalDTO = {
        user_id: userId,
        device_id: req.body.device_id,
        station_from_id: req.body.station_from_id,
        deposit_amount: 5000, // TZS 5,000 deposit
        payment_method: req.body.payment_method || 'mpesa',
        qr_code: req.body.qr_code
      };

      // Validate required fields
      if (!rentalData.device_id || !rentalData.station_from_id) {
        return res.status(400).json({
          success: false,
          error: 'Device ID and station ID are required'
        });
      }

      const rental = await rentalService.createRental(rentalData);

      res.json({
        success: true,
        message: 'Rental started successfully',
        data: {
          rental: {
            id: rental.id,
            rental_code: rental.rental_code,
            device_id: rental.device_id,
            start_time: rental.start_time,
            expected_end_time: rental.expected_end_time,
            deposit_amount: rental.deposit_amount
          },
          payment_required: true,
          deposit_amount: rental.deposit_amount
        }
      });
    } catch (error: any) {
      logger.error('Start rental error:', error);
      
      const statusCode = error.message.includes('not available') ? 400 : 500;
      const errorMessage = error.message.includes('not active') 
        ? 'Your account is not active. Please contact support.' 
        : error.message;

      res.status(statusCode).json({
        success: false,
        error: errorMessage
      });
    }
  }

  async completeRental(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const rentalId = req.params.rentalId;
      const completeData: CompleteRentalDTO = {
        rental_id: rentalId,
        station_to_id: req.body.station_to_id,
        total_hours: parseFloat(req.body.total_hours),
        notes: req.body.notes
      };

      // Validate
      if (!completeData.station_to_id || !completeData.total_hours || completeData.total_hours <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Station ID and valid total hours are required'
        });
      }

      // Check if user owns this rental
      const rental = await rentalService.getRentalByCode(rentalId);
      if (!rental) {
        return res.status(404).json({
          success: false,
          error: 'Rental not found'
        });
      }

      if (rental.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to complete this rental'
        });
      }

      const completedRental = await rentalService.completeRental(completeData);

      res.json({
        success: true,
        message: 'Rental completed successfully',
        data: {
          rental: {
            id: completedRental.id,
            rental_code: completedRental.rental_code,
            total_hours: completedRental.total_hours,
            base_amount: completedRental.base_amount,
            tax_amount: completedRental.tax_amount,
            total_amount: completedRental.total_amount,
            deposit_returned: completedRental.deposit_returned,
            deposit_return_amount: completedRental.deposit_return_amount,
            end_time: completedRental.end_time
          },
          summary: {
            hours_rented: completedRental.total_hours,
            rental_cost: completedRental.base_amount,
            tax: completedRental.tax_amount,
            total_charged: completedRental.total_amount,
            deposit_returned: completedRental.deposit_return_amount
          }
        }
      });
    } catch (error: any) {
      logger.error('Complete rental error:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to complete rental'
      });
    }
  }

  async getActiveRental(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const rental = await rentalService.getUserActiveRental(userId);

      if (!rental) {
        return res.json({
          success: true,
          data: null,
          message: 'No active rentals'
        });
      }

      // Calculate time remaining
      const now = new Date();
      const expectedEnd = new Date(rental.expected_end_time);
      const hoursRemaining = Math.max(0, (expectedEnd.getTime() - now.getTime()) / (1000 * 60 * 60));

      res.json({
        success: true,
        data: {
          rental: {
            id: rental.id,
            rental_code: rental.rental_code,
            device_id: rental.device_id,
            device_code: (rental as any).device_code,
            station_from: (rental as any).station_name,
            start_time: rental.start_time,
            expected_end_time: rental.expected_end_time,
            hours_remaining: hoursRemaining.toFixed(1),
            deposit_amount: rental.deposit_amount
          }
        }
      });
    } catch (error) {
      logger.error('Get active rental error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active rental'
      });
    }
  }

  async getRentalHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const rentals = await rentalService.getUserRentals(userId, limit);

      const formattedRentals = rentals.map(rental => ({
        id: rental.id,
        rental_code: rental.rental_code,
        device_code: (rental as any).device_code,
        station_from: (rental as any).station_from_name,
        station_to: (rental as any).station_to_name,
        start_time: rental.start_time,
        end_time: rental.end_time,
        total_hours: rental.total_hours,
        total_amount: rental.total_amount,
        rental_status: rental.rental_status,
        payment_status: rental.payment_status
      }));

      res.json({
        success: true,
        data: {
          rentals: formattedRentals,
          total_count: rentals.length,
          total_spent: rentals.reduce((sum, rental) => sum + (rental.total_amount || 0), 0)
        }
      });
    } catch (error) {
      logger.error('Get rental history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rental history'
      });
    }
  }

  async calculatePrice(req: Request, res: Response) {
    try {
      const hours = parseFloat(req.query.hours as string);
      
      if (!hours || hours <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid hours are required'
        });
      }

      const amount = await rentalService.calculateRentalAmount(hours);

      res.json({
        success: true,
        data: {
          hours: hours,
          pricing: {
            first_hour: 600,
            additional_hour: 400,
            daily_cap: 3000,
            tax_rate: 0.18
          },
          breakdown: {
            base_amount: amount.base_amount,
            tax_amount: amount.tax_amount,
            total_amount: amount.total_amount,
            deposit_amount: 5000,
            deposit_return: amount.deposit_return
          },
          summary: `TZS ${amount.total_amount.toFixed(2)} for ${hours} hour${hours !== 1 ? 's' : ''}`
        }
      });
    } catch (error) {
      logger.error('Calculate price error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate price'
      });
    }
  }

  async getAvailableDevices(req: Request, res: Response) {
    try {
      const stationId = req.query.station_id as string;
      const devices = await deviceService.getAvailableDevices(stationId);

      const formattedDevices = devices.map(device => ({
        id: device.id,
        device_code: device.device_code,
        station_id: device.station_id,
        station_name: (device as any).station_name,
        city: (device as any).city,
        battery_level: device.battery_level,
        health_score: device.health_score,
        last_maintenance: device.last_maintenance_date
      }));

      res.json({
        success: true,
        data: {
          devices: formattedDevices,
          count: devices.length,
          stations: stationId ? 1 : 'all'
        }
      });
    } catch (error) {
      logger.error('Get available devices error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get available devices'
      });
    }
  }

  async scanQRCode(req: Request, res: Response) {
    try {
      const { qr_code } = req.body;
      
      if (!qr_code) {
        return res.status(400).json({
          success: false,
          error: 'QR code is required'
        });
      }

      // In real implementation, decode QR and get device info
      // For now, simulate device lookup
      const deviceCode = qr_code.split('-')[1]; // Simple parsing
      const device = await deviceService.getDeviceByCode(deviceCode);

      if (!device) {
        return res.status(404).json({
          success: false,
          error: 'Device not found'
        });
      }

      if (device.current_status !== 'available') {
        return res.status(400).json({
          success: false,
          error: `Device is currently ${device.current_status}`
        });
      }

      res.json({
        success: true,
        data: {
          device: {
            id: device.id,
            device_code: device.device_code,
            station_id: device.station_id,
            station_name: (device as any).station_name,
            battery_level: device.battery_level,
            health_score: device.health_score
          },
          pricing: {
            first_hour: 600,
            additional_hour: 400,
            daily_cap: 3000,
            deposit: 5000
          },
          next_step: 'start_rental'
        }
      });
    } catch (error) {
      logger.error('Scan QR code error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to scan QR code'
      });
    }
  }
}