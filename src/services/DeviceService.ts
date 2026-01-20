import { query } from '../config/database';
import { Device, DeviceStatusUpdate } from '../models/Device';
import logger from '../config/logger';

export class DeviceService {
  async getAvailableDevices(stationId?: string): Promise<Device[]> {
    try {
      let queryStr = `
        SELECT d.*, s.name as station_name, s.city
        FROM devices d
        LEFT JOIN stations s ON d.station_id = s.id
        WHERE d.current_status = 'available'
        AND d.is_active = true
      `;
      
      const params = [];
      
      if (stationId) {
        queryStr += ' AND d.station_id = $1';
        params.push(stationId);
      }
      
      queryStr += ' ORDER BY d.battery_level DESC';
      
      const result = await query(queryStr, params);
      return result.rows;
    } catch (error) {
      logger.error('Get available devices error:', error);
      throw error;
    }
  }

  async getDeviceByCode(deviceCode: string): Promise<Device | null> {
    try {
      const result = await query(
        `SELECT d.*, s.name as station_name, s.address
         FROM devices d
         LEFT JOIN stations s ON d.station_id = s.id
         WHERE d.device_code = $1`,
        [deviceCode]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get device by code error:', error);
      throw error;
    }
  }

  async updateDeviceStatus(updateData: DeviceStatusUpdate): Promise<Device> {
    try {
      const result = await query(
        `UPDATE devices 
         SET battery_level = $1,
             ${updateData.location ? 'last_known_latitude = $3, last_known_longitude = $4,' : ''}
             ${updateData.health_score ? 'health_score = $5,' : ''}
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [
          updateData.battery_level,
          updateData.device_id,
          ...(updateData.location ? [updateData.location.latitude, updateData.location.longitude] : []),
          ...(updateData.health_score ? [updateData.health_score] : [])
        ].filter(Boolean)
      );
      
      if (result.rows.length === 0) {
        throw new Error('Device not found');
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error('Update device status error:', error);
      throw error;
    }
  }

  async getDevicesNeedingMaintenance(threshold: number = 70): Promise<Device[]> {
    try {
      const result = await query(
        `SELECT d.*, s.name as station_name
         FROM devices d
         LEFT JOIN stations s ON d.station_id = s.id
         WHERE d.health_score < $1
         AND d.is_active = true
         ORDER BY d.health_score ASC`,
        [threshold]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Get devices needing maintenance error:', error);
      throw error;
    }
  }

  async getStationDevices(stationId: string): Promise<Device[]> {
    try {
      const result = await query(
        `SELECT d.*, 
                CASE 
                  WHEN d.current_status = 'available' THEN 'Available'
                  WHEN d.current_status = 'rented' THEN 'Rented'
                  ELSE 'Maintenance'
                END as status_display
         FROM devices d
         WHERE d.station_id = $1
         AND d.is_active = true
         ORDER BY d.current_status, d.battery_level DESC`,
        [stationId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Get station devices error:', error);
      throw error;
    }
  }
}