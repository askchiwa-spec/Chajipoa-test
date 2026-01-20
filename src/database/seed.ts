import { query } from '../config/database';
import logger from '../config/logger';

export async function seedTestData() {
  try {
    logger.info('Seeding test data...');

    // 1. Create test users
    await query(`
      INSERT INTO users (phone_number, first_name, last_name, user_type, deposit_balance) 
      VALUES 
        ('0755111001', 'John', 'Bandawe', 'regular', 10000),
        ('0755111002', 'Sarah', 'Moshi', 'tourist', 15000),
        ('0755111003', 'Michael', 'Kondo', 'corporate', 50000)
      ON CONFLICT (phone_number) DO NOTHING
    `);

    // 2. Add more devices
    await query(`
      INSERT INTO devices (device_code, station_id, current_status, battery_level, health_score) 
      VALUES 
        ('DEV006', (SELECT id FROM stations WHERE station_code = 'STN001'), 'available', 88, 92),
        ('DEV007', (SELECT id FROM stations WHERE station_code = 'STN001'), 'available', 91, 96),
        ('DEV008', (SELECT id FROM stations WHERE station_code = 'STN002'), 'available', 76, 85),
        ('DEV009', (SELECT id FROM stations WHERE station_code = 'STN003'), 'available', 94, 98),
        ('DEV010', (SELECT id FROM stations WHERE station_code = 'STN003'), 'maintenance', 32, 65)
      ON CONFLICT (device_code) DO NOTHING
    `);

    // 3. Create completed rentals for history
    const users = await query('SELECT id FROM users LIMIT 2');
    const devices = await query('SELECT id FROM devices WHERE current_status = \'available\' LIMIT 3');
    const stations = await query('SELECT id FROM stations LIMIT 2');

    if (users.rows.length > 0 && devices.rows.length > 0 && stations.rows.length > 0) {
      const year = new Date().getFullYear().toString().slice(2);
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const day = new Date().getDate().toString().padStart(2, '0');
      
      await query(`
        INSERT INTO rentals (
          rental_code, user_id, device_id, station_from_id, station_to_id,
          rental_status, start_time, end_time, total_hours,
          base_amount, tax_amount, total_amount, deposit_amount,
          deposit_returned, deposit_return_amount, payment_status
        ) 
        VALUES 
          (
            'RENT-${year}${month}${day}-TEST01',
            $1, $2, $3, $4,
            'completed', 
            CURRENT_TIMESTAMP - INTERVAL '3 hours',
            CURRENT_TIMESTAMP - INTERVAL '2 hours',
            1.5,
            1000, 180, 1180, 5000,
            true, 3820, 'completed'
          ),
          (
            'RENT-${year}${month}${day}-TEST02',
            $5, $6, $7, $8,
            'completed', 
            CURRENT_TIMESTAMP - INTERVAL '5 hours',
            CURRENT_TIMESTAMP - INTERVAL '3 hours',
            2.0,
            1400, 252, 1652, 5000,
            true, 3348, 'completed'
          )
      `, [
        users.rows[0].id, devices.rows[0].id, stations.rows[0].id, stations.rows[1].id,
        users.rows[1]?.id || users.rows[0].id, devices.rows[1].id, stations.rows[1].id, stations.rows[0].id
      ]);
    }

    // 4. Update station statistics
    await query(`
      UPDATE stations s
      SET 
        total_rentals = (
          SELECT COUNT(*) 
          FROM rentals r 
          WHERE r.station_from_id = s.id OR r.station_to_id = s.id
        ),
        total_revenue = (
          SELECT COALESCE(SUM(total_amount), 0)
          FROM rentals r 
          WHERE r.station_to_id = s.id AND r.rental_status = 'completed'
        )
    `);

    logger.info('✅ Test data seeded successfully');
  } catch (error) {
    logger.error('❌ Failed to seed test data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}