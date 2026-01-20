const { postgresPool } = require('../config/database');
const redisClient = require('../config/redis');
const logger = require('../config/logger');
const { generateRentalCode, calculateRentalCost, generateTransactionCode } = require('../utils/helpers');
const QRCodeService = require('../services/QRCodeService');
const SMSService = require('../services/SMSService');
const AuditLog = require('../models/AuditLog');
const { rentalSchemas } = require('../validators/schemas');

class RentalController {
  /**
   * Start a new rental
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async startRental(req, res, next) {
    const client = await postgresPool.connect();
    
    try {
      await client.query('BEGIN');
      
      const userId = req.user.userId;
      const { device_code, station_id } = req.validatedBody;

      // 1. Validate device exists and is available
      const deviceQuery = `
        SELECT id, current_status, battery_level, station_id 
        FROM devices 
        WHERE device_code = $1 AND is_active = true
      `;
      const deviceResult = await client.query(deviceQuery, [device_code]);
      
      if (deviceResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      const device = deviceResult.rows[0];
      
      if (device.current_status !== 'available') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Device is currently ${device.current_status}`
        });
      }

      // 2. Validate station exists and is operational
      const stationQuery = `
        SELECT id, name, available_slots, is_operational 
        FROM stations 
        WHERE id = $1 AND is_operational = true
      `;
      const stationResult = await client.query(stationQuery, [station_id]);
      
      if (stationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Station not found or not operational'
        });
      }

      const station = stationResult.rows[0];
      
      if (device.station_id !== station_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Device is not located at the specified station'
        });
      }

      // 3. Check if user has active rentals
      const activeRentalQuery = `
        SELECT id FROM rentals 
        WHERE user_id = $1 AND rental_status IN ('active', 'overdue')
      `;
      const activeRentalResult = await client.query(activeRentalQuery, [userId]);
      
      if (activeRentalResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'You already have an active rental'
        });
      }

      // 4. Check user account status
      const userQuery = `
        SELECT account_status, deposit_balance 
        FROM users 
        WHERE id = $1
      `;
      const userResult = await client.query(userQuery, [userId]);
      const user = userResult.rows[0];
      
      if (user.account_status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'Account is not active'
        });
      }

      // 5. Generate rental code and create rental record
      const rentalCode = generateRentalCode();
      const startTime = new Date();
      const expectedEndTime = new Date(startTime.getTime() + (4 * 60 * 60 * 1000)); // 4 hours default
      
      const insertRentalQuery = `
        INSERT INTO rentals (
          rental_code, user_id, device_id, station_from_id, 
          rental_status, start_time, expected_end_time,
          deposit_amount, base_amount, tax_amount, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, rental_code
      `;
      
      // Calculate initial costs (deposit + 4 hours rental)
      const depositAmount = 5000; // TZS 5000 deposit
      const initialRental = calculateRentalCost(startTime, expectedEndTime);
      
      const rentalResult = await client.query(insertRentalQuery, [
        rentalCode, userId, device.id, station_id,
        'active', startTime, expectedEndTime,
        depositAmount, initialRental.baseAmount, initialRental.taxAmount, 
        depositAmount + initialRental.totalAmount
      ]);
      
      const rental = rentalResult.rows[0];

      // 6. Update device status
      const updateDeviceQuery = `
        UPDATE devices 
        SET current_status = 'rented', rental_count = rental_count + 1
        WHERE id = $1
      `;
      await client.query(updateDeviceQuery, [device.id]);

      // 7. Update station slots
      const updateStationQuery = `
        UPDATE stations 
        SET available_slots = available_slots - 1
        WHERE id = $1
      `;
      await client.query(updateStationQuery, [station_id]);

      // 8. Update user deposit balance
      const updateUserQuery = `
        UPDATE users 
        SET deposit_balance = deposit_balance + $1, total_rentals = total_rentals + 1
        WHERE id = $2
      `;
      await client.query(updateUserQuery, [depositAmount, userId]);

      await client.query('COMMIT');

      // Generate QR code for return
      const returnQR = await QRCodeService.generateRentalQR({
        deviceId: device.id,
        stationId: station_id,
        userId: userId,
        rentalType: 'return',
        rentalId: rental.id
      });

      // Send confirmation SMS
      try {
        await SMSService.sendRentalConfirmation(user.phone_number, {
          rentalCode: rental.rental_code,
          deviceCode: device_code,
          stationName: station.name,
          startTime: startTime,
          expectedEndTime: expectedEndTime,
          amount: depositAmount + initialRental.totalAmount
        });
      } catch (smsError) {
        logger.error('Failed to send rental confirmation SMS', { 
          userId, 
          error: smsError.message 
        });
      }

      // Log audit trail
      await AuditLog.create({
        action: 'RENTAL_START',
        resourceType: 'rental',
        resourceId: rental.id,
        userId: userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestData: { device_code, station_id },
        statusCode: 201,
        severity: 'INFO'
      });

      logger.info('Rental started successfully', { 
        userId, 
        rentalId: rental.id, 
        deviceCode: device_code 
      });

      res.status(201).json({
        success: true,
        message: 'Rental started successfully',
        data: {
          rental: {
            id: rental.id,
            rental_code: rental.rental_code,
            device_code,
            station_name: station.name,
            start_time: startTime,
            expected_end_time: expectedEndTime,
            deposit_amount: depositAmount,
            initial_rental_amount: initialRental.totalAmount,
            total_amount: depositAmount + initialRental.totalAmount
          },
          return_qr: returnQR.qrImageUrl
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Start rental failed:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  /**
   * End a rental
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async endRental(req, res, next) {
    const client = await postgresPool.connect();
    
    try {
      await client.query('BEGIN');
      
      const userId = req.user.userId;
      const { rental_id } = req.params;
      const { station_id } = req.validatedBody || {};

      // 1. Get rental details
      const rentalQuery = `
        SELECT r.*, d.device_code, d.station_id as device_station_id,
               s_from.name as station_from_name,
               u.phone_number, u.deposit_balance
        FROM rentals r
        JOIN devices d ON r.device_id = d.id
        JOIN stations s_from ON r.station_from_id = s_from.id
        JOIN users u ON r.user_id = u.id
        WHERE r.id = $1 AND r.user_id = $2 AND r.rental_status = 'active'
      `;
      
      const rentalResult = await client.query(rentalQuery, [rental_id, userId]);
      
      if (rentalResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Active rental not found'
        });
      }

      const rental = rentalResult.rows[0];
      const endTime = new Date();

      // 2. Calculate final costs
      const finalRental = calculateRentalCost(rental.start_time, endTime);
      const totalRentalAmount = finalRental.totalAmount;
      let lateFee = 0;

      // Calculate late fees if overdue
      if (endTime > new Date(rental.expected_end_time)) {
        const hoursOverdue = (endTime - new Date(rental.expected_end_time)) / (1000 * 60 * 60);
        lateFee = Math.ceil(hoursOverdue) * 200; // TZS 200 per hour overdue
      }

      const finalTotalAmount = rental.deposit_amount + totalRentalAmount + lateFee;

      // 3. Determine return station
      let returnStationId = station_id || rental.device_station_id;
      let stationToName = rental.station_from_name;

      if (station_id && station_id !== rental.station_from_id) {
        // Different return station - validate it exists
        const stationQuery = `
          SELECT name, available_slots, is_operational 
          FROM stations 
          WHERE id = $1 AND is_operational = true
        `;
        const stationResult = await client.query(stationQuery, [station_id]);
        
        if (stationResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            message: 'Return station not found or not operational'
          });
        }
        
        returnStationId = station_id;
        stationToName = stationResult.rows[0].name;
      }

      // 4. Update rental record
      const updateRentalQuery = `
        UPDATE rentals 
        SET rental_status = 'completed', 
            end_time = $1,
            station_to_id = $2,
            total_hours = $3,
            base_amount = $4,
            tax_amount = $5,
            late_fee = $6,
            total_amount = $7,
            payment_status = 'completed'
        WHERE id = $8
      `;
      
      await client.query(updateRentalQuery, [
        endTime, returnStationId, finalRental.totalHours,
        finalRental.baseAmount, finalRental.taxAmount,
        lateFee, finalTotalAmount, rental_id
      ]);

      // 5. Update device status
      const updateDeviceQuery = `
        UPDATE devices 
        SET current_status = 'available', 
            station_id = $1,
            total_earnings = total_earnings + $2
        WHERE id = $3
      `;
      await client.query(updateDeviceQuery, [returnStationId, totalRentalAmount, rental.device_id]);

      // 6. Update station slots
      const updateStationsQuery = `
        UPDATE stations 
        SET available_slots = available_slots + 1
        WHERE id = $1 OR id = $2
      `;
      await client.query(updateStationsQuery, [rental.station_from_id, returnStationId]);

      // 7. Update user deposit balance (return deposit minus fees)
      const depositReturn = Math.max(0, rental.deposit_amount - lateFee);
      const updateUserQuery = `
        UPDATE users 
        SET deposit_balance = deposit_balance - $1 + $2,
            total_spent = total_spent + $3
        WHERE id = $4
      `;
      await client.query(updateUserQuery, [
        rental.deposit_amount, 
        depositReturn, 
        totalRentalAmount + lateFee, 
        userId
      ]);

      await client.query('COMMIT');

      // Send return confirmation SMS
      try {
        await SMSService.sendPaymentConfirmation(rental.phone_number, {
          transactionCode: generateTransactionCode('RTN'),
          amount: totalRentalAmount + lateFee,
          paymentMethod: 'Deposit',
          rentalCode: rental.rental_code
        });
      } catch (smsError) {
        logger.error('Failed to send return confirmation SMS', { 
          userId, 
          error: smsError.message 
        });
      }

      // Log audit trail
      await AuditLog.create({
        action: 'RENTAL_END',
        resourceType: 'rental',
        resourceId: rental_id,
        userId: userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestData: { station_id },
        responseData: { 
          total_amount: finalTotalAmount,
          late_fee: lateFee,
          rental_hours: finalRental.totalHours
        },
        statusCode: 200,
        severity: 'INFO'
      });

      logger.info('Rental ended successfully', { 
        userId, 
        rentalId: rental_id, 
        totalAmount: finalTotalAmount 
      });

      res.status(200).json({
        success: true,
        message: 'Rental completed successfully',
        data: {
          rental: {
            id: rental_id,
            rental_code: rental.rental_code,
            device_code: rental.device_code,
            start_time: rental.start_time,
            end_time: endTime,
            total_hours: finalRental.totalHours,
            base_amount: finalRental.baseAmount,
            tax_amount: finalRental.taxAmount,
            late_fee: lateFee,
            deposit_returned: depositReturn > 0,
            deposit_return_amount: depositReturn,
            total_amount: finalTotalAmount,
            station_from: rental.station_from_name,
            station_to: stationToName
          }
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('End rental failed:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  /**
   * Get user's active rental
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getActiveRental(req, res, next) {
    try {
      const userId = req.user.userId;

      const query = `
        SELECT 
          r.id, r.rental_code, r.start_time, r.expected_end_time, r.total_amount,
          d.device_code, d.battery_level,
          s.name as station_name
        FROM rentals r
        JOIN devices d ON r.device_id = d.id
        JOIN stations s ON r.station_from_id = s.id
        WHERE r.user_id = $1 AND r.rental_status = 'active'
      `;
      
      const result = await postgresPool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No active rental found'
        });
      }

      const rental = result.rows[0];
      const timeRemaining = new Date(rental.expected_end_time) - new Date();
      const isOverdue = timeRemaining < 0;

      res.status(200).json({
        success: true,
        data: {
          rental: {
            ...rental,
            time_remaining_ms: Math.max(0, timeRemaining),
            is_overdue: isOverdue,
            overdue_minutes: isOverdue ? Math.abs(timeRemaining) / (1000 * 60) : 0
          }
        }
      });
    } catch (error) {
      logger.error('Get active rental failed:', error);
      next(error);
    }
  }

  /**
   * Extend rental period
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async extendRental(req, res, next) {
    const client = await postgresPool.connect();
    
    try {
      await client.query('BEGIN');
      
      const userId = req.user.userId;
      const { rental_id } = req.params;
      const { extension_hours } = req.validatedBody;

      // Get current rental
      const rentalQuery = `
        SELECT r.*, d.device_code, s.name as station_name
        FROM rentals r
        JOIN devices d ON r.device_id = d.id
        JOIN stations s ON r.station_from_id = s.id
        WHERE r.id = $1 AND r.user_id = $2 AND r.rental_status = 'active'
      `;
      
      const rentalResult = await client.query(rentalQuery, [rental_id, userId]);
      
      if (rentalResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Active rental not found'
        });
      }

      const rental = rentalResult.rows[0];
      
      // Calculate new end time and costs
      const currentEndTime = new Date(rental.expected_end_time);
      const newEndTime = new Date(currentEndTime.getTime() + (extension_hours * 60 * 60 * 1000));
      
      const extensionRental = calculateRentalCost(currentEndTime, newEndTime);
      
      // Update rental
      const updateQuery = `
        UPDATE rentals 
        SET expected_end_time = $1,
            base_amount = base_amount + $2,
            tax_amount = tax_amount + $3,
            total_amount = total_amount + $4
        WHERE id = $5
      `;
      
      await client.query(updateQuery, [
        newEndTime,
        extensionRental.baseAmount,
        extensionRental.taxAmount,
        extensionRental.totalAmount,
        rental_id
      ]);

      await client.query('COMMIT');

      // Log audit trail
      await AuditLog.create({
        action: 'RENTAL_EXTEND',
        resourceType: 'rental',
        resourceId: rental_id,
        userId: userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestData: { extension_hours },
        responseData: { 
          additional_amount: extensionRental.totalAmount,
          new_end_time: newEndTime
        },
        statusCode: 200,
        severity: 'INFO'
      });

      logger.info('Rental extended successfully', { 
        userId, 
        rentalId: rental_id, 
        extensionHours: extension_hours 
      });

      res.status(200).json({
        success: true,
        message: 'Rental extended successfully',
        data: {
          rental: {
            id: rental_id,
            rental_code: rental.rental_code,
            device_code: rental.device_code,
            station_name: rental.station_name,
            original_end_time: rental.expected_end_time,
            new_end_time: newEndTime,
            extension_hours: extension_hours,
            additional_amount: extensionRental.totalAmount
          }
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Extend rental failed:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  /**
   * Report device as lost
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async reportLostDevice(req, res, next) {
    const client = await postgresPool.connect();
    
    try {
      await client.query('BEGIN');
      
      const userId = req.user.userId;
      const { rental_id } = req.params;
      const { notes } = req.body || {};

      // Get rental details
      const rentalQuery = `
        SELECT r.id, r.device_id, r.rental_code,
               d.device_code, d.station_id
        FROM rentals r
        JOIN devices d ON r.device_id = d.id
        WHERE r.id = $1 AND r.user_id = $2 AND r.rental_status = 'active'
      `;
      
      const rentalResult = await client.query(rentalQuery, [rental_id, userId]);
      
      if (rentalResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Active rental not found'
        });
      }

      const rental = rentalResult.rows[0];

      // Update rental status
      const updateRentalQuery = `
        UPDATE rentals 
        SET rental_status = 'lost', notes = COALESCE(notes, '') || $1
        WHERE id = $2
      `;
      await client.query(updateRentalQuery, [`\nLost reported: ${notes || 'No notes provided'}`, rental_id]);

      // Update device status
      const updateDeviceQuery = `
        UPDATE devices 
        SET current_status = 'lost', is_active = false
        WHERE id = $1
      `;
      await client.query(updateDeviceQuery, [rental.device_id]);

      await client.query('COMMIT');

      // Log audit trail
      await AuditLog.create({
        action: 'RENTAL_LOST_REPORT',
        resourceType: 'rental',
        resourceId: rental_id,
        userId: userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        requestData: { notes },
        statusCode: 200,
        severity: 'WARN'
      });

      logger.warn('Device reported as lost', { 
        userId, 
        rentalId: rental_id, 
        deviceCode: rental.device_code 
      });

      res.status(200).json({
        success: true,
        message: 'Device reported as lost. Our team will contact you shortly.',
        data: {
          rental_code: rental.rental_code,
          device_code: rental.device_code
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Report lost device failed:', error);
      next(error);
    } finally {
      client.release();
    }
  }
}

module.exports = new RentalController();