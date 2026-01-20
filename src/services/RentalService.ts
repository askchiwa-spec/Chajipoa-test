import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { query } from '../config/database';
import { 
  Rental, 
  CreateRentalDTO, 
  CompleteRentalDTO, 
  DEFAULT_PRICING,
  PricingConfig 
} from '../models/Rental';
import logger from '../config/logger';
import redis from '../config/redis';

export class RentalService {
  private pricing: PricingConfig;

  constructor(pricingConfig: PricingConfig = DEFAULT_PRICING) {
    this.pricing = pricingConfig;
  }

  async createRental(rentalData: CreateRentalDTO): Promise<Rental> {
    const client = await query.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Generate unique rental code
      const rentalCode = `RENT-${moment().format('YYMMDD')}-${uuidv4().slice(0, 8).toUpperCase()}`;
      
      // 2. Check if device is available
      const deviceCheck = await client.query(
        `SELECT * FROM devices 
         WHERE id = $1 
         AND current_status = 'available' 
         AND is_active = true`,
        [rentalData.device_id]
      );

      if (deviceCheck.rows.length === 0) {
        throw new Error('Device is not available for rental');
      }

      // 3. Check user deposit balance
      const userCheck = await client.query(
        `SELECT deposit_balance, account_status 
         FROM users 
         WHERE id = $1`,
        [rentalData.user_id]
      );

      if (userCheck.rows.length === 0) {
        throw new Error('User not found');
      }

      if (userCheck.rows[0].account_status !== 'active') {
        throw new Error('User account is not active');
      }

      // 4. Create rental record
      const rentalResult = await client.query(
        `INSERT INTO rentals (
          rental_code, user_id, device_id, station_from_id,
          deposit_amount, payment_method, payment_status,
          rental_status, qr_code_used, expected_end_time
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'active', $7, $8)
        RETURNING *`,
        [
          rentalCode,
          rentalData.user_id,
          rentalData.device_id,
          rentalData.station_from_id,
          this.pricing.deposit_amount,
          rentalData.payment_method,
          rentalData.qr_code,
          moment().add(24, 'hours').toDate() // Default 24-hour rental
        ]
      );

      const rental = rentalResult.rows[0];

      // 5. Update device status
      await client.query(
        `UPDATE devices 
         SET current_status = 'rented',
             station_id = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [rentalData.device_id]
      );

      // 6. Update station available slots
      await client.query(
        `UPDATE stations 
         SET available_slots = available_slots + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [rentalData.station_from_id]
      );

      // 7. Update user rental count
      await client.query(
        `UPDATE users 
         SET total_rentals = total_rentals + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [rentalData.user_id]
      );

      await client.query('COMMIT');

      // Cache rental for fast lookup
      await redis.setex(`rental:${rentalCode}`, 3600, JSON.stringify(rental));

      logger.info(`Rental created: ${rentalCode} for user ${rentalData.user_id}`);
      
      return rental;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Create rental error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async completeRental(rentalData: CompleteRentalDTO): Promise<Rental> {
    const client = await query.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Get rental details
      const rentalResult = await client.query(
        `SELECT r.*, d.device_code, u.phone_number
         FROM rentals r
         JOIN devices d ON r.device_id = d.id
         JOIN users u ON r.user_id = u.id
         WHERE r.id = $1 AND r.rental_status = 'active'`,
        [rentalData.rental_id]
      );

      if (rentalResult.rows.length === 0) {
        throw new Error('Active rental not found');
      }

      const rental = rentalResult.rows[0];
      
      // 2. Calculate rental amount
      const hours = rentalData.total_hours;
      let baseAmount = 0;
      
      if (hours <= 1) {
        baseAmount = this.pricing.first_hour;
      } else {
        baseAmount = this.pricing.first_hour + (hours - 1) * this.pricing.additional_hour;
      }

      // Apply daily cap
      if (baseAmount > this.pricing.daily_cap) {
        baseAmount = this.pricing.daily_cap;
      }

      const taxAmount = baseAmount * this.pricing.tax_rate;
      const totalAmount = baseAmount + taxAmount;
      const depositReturn = this.pricing.deposit_amount - totalAmount;

      // 3. Update rental record
      const updateResult = await client.query(
        `UPDATE rentals 
         SET station_to_id = $1,
             end_time = CURRENT_TIMESTAMP,
             total_hours = $2,
             base_amount = $3,
             tax_amount = $4,
             total_amount = $5,
             deposit_returned = $6,
             deposit_return_amount = $7,
             rental_status = 'completed',
             payment_status = 'completed',
             notes = COALESCE($8, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [
          rentalData.station_to_id,
          hours,
          baseAmount,
          taxAmount,
          totalAmount,
          depositReturn > 0,
          depositReturn > 0 ? depositReturn : 0,
          rentalData.notes,
          rentalData.rental_id
        ]
      );

      const updatedRental = updateResult.rows[0];

      // 4. Update device status and location
      await client.query(
        `UPDATE devices 
         SET current_status = 'available',
             station_id = $1,
             rental_count = rental_count + 1,
             total_earnings = total_earnings + $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [rentalData.station_to_id, totalAmount, rental.device_id]
      );

      // 5. Update station available slots
      await client.query(
        `UPDATE stations 
         SET available_slots = available_slots - 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [rentalData.station_to_id]
      );

      // 6. Update user account
      await client.query(
        `UPDATE users 
         SET deposit_balance = deposit_balance - $1,
             total_spent = total_spent + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [totalAmount, rental.user_id]
      );

      // 7. If deposit return is positive, add back to user balance
      if (depositReturn > 0) {
        await client.query(
          `UPDATE users 
           SET deposit_balance = deposit_balance + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [depositReturn, rental.user_id]
        );
      }

      await client.query('COMMIT');

      // Clear rental cache
      await redis.del(`rental:${rental.rental_code}`);

      // Log transaction
      await this.logTransaction({
        rental_id: updatedRental.id,
        user_id: updatedRental.user_id,
        amount: totalAmount,
        type: 'rental_completion'
      });

      logger.info(`Rental completed: ${rental.rental_code}, Amount: TZS ${totalAmount}`);
      
      return updatedRental;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Complete rental error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserActiveRental(userId: string): Promise<Rental | null> {
    try {
      const result = await query(
        `SELECT r.*, d.device_code, s.name as station_name
         FROM rentals r
         LEFT JOIN devices d ON r.device_id = d.id
         LEFT JOIN stations s ON r.station_from_id = s.id
         WHERE r.user_id = $1 
         AND r.rental_status = 'active'
         ORDER BY r.start_time DESC
         LIMIT 1`,
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get user active rental error:', error);
      throw error;
    }
  }

  async getUserRentals(userId: string, limit: number = 10): Promise<Rental[]> {
    try {
      const result = await query(
        `SELECT r.*, d.device_code, 
                s_from.name as station_from_name,
                s_to.name as station_to_name
         FROM rentals r
         LEFT JOIN devices d ON r.device_id = d.id
         LEFT JOIN stations s_from ON r.station_from_id = s_from.id
         LEFT JOIN stations s_to ON r.station_to_id = s_to.id
         WHERE r.user_id = $1 
         ORDER BY r.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Get user rentals error:', error);
      throw error;
    }
  }

  async getRentalByCode(rentalCode: string): Promise<Rental | null> {
    try {
      // Try cache first
      const cached = await redis.get(`rental:${rentalCode}`);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await query(
        `SELECT r.*, 
                u.phone_number, u.first_name, u.last_name,
                d.device_code, d.battery_level,
                s_from.name as station_from_name,
                s_to.name as station_to_name
         FROM rentals r
         JOIN users u ON r.user_id = u.id
         JOIN devices d ON r.device_id = d.id
         LEFT JOIN stations s_from ON r.station_from_id = s_from.id
         LEFT JOIN stations s_to ON r.station_to_id = s_to.id
         WHERE r.rental_code = $1`,
        [rentalCode]
      );

      if (result.rows[0]) {
        // Cache for 1 hour
        await redis.setex(`rental:${rentalCode}`, 3600, JSON.stringify(result.rows[0]));
      }

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get rental by code error:', error);
      throw error;
    }
  }

  async calculateRentalAmount(hours: number): Promise<{
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    deposit_return: number;
  }> {
    let baseAmount = 0;
    
    if (hours <= 1) {
      baseAmount = this.pricing.first_hour;
    } else {
      baseAmount = this.pricing.first_hour + (hours - 1) * this.pricing.additional_hour;
    }

    // Apply daily cap
    if (baseAmount > this.pricing.daily_cap) {
      baseAmount = this.pricing.daily_cap;
    }

    const taxAmount = baseAmount * this.pricing.tax_rate;
    const totalAmount = baseAmount + taxAmount;
    const depositReturn = this.pricing.deposit_amount - totalAmount;

    return {
      base_amount: baseAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      deposit_return: depositReturn > 0 ? depositReturn : 0
    };
  }

  async checkOverdueRentals(): Promise<Rental[]> {
    try {
      const result = await query(
        `SELECT r.*, u.phone_number, d.device_code
         FROM rentals r
         JOIN users u ON r.user_id = u.id
         JOIN devices d ON r.device_id = d.id
         WHERE r.rental_status = 'active'
         AND r.expected_end_time < CURRENT_TIMESTAMP
         AND r.end_time IS NULL`,
        []
      );

      // Mark as overdue
      for (const rental of result.rows) {
        await query(
          `UPDATE rentals 
           SET rental_status = 'overdue',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [rental.id]
        );

        // Send notification (would integrate with notification service)
        logger.warn(`Rental overdue: ${rental.rental_code}, User: ${rental.phone_number}`);
      }

      return result.rows;
    } catch (error) {
      logger.error('Check overdue rentals error:', error);
      throw error;
    }
  }

  private async logTransaction(transaction: {
    rental_id: string;
    user_id: string;
    amount: number;
    type: string;
  }): Promise<void> {
    try {
      // This would typically log to a transactions table or external service
      logger.info(`Transaction logged: ${JSON.stringify(transaction)}`);
    } catch (error) {
      logger.error('Log transaction error:', error);
    }
  }
}