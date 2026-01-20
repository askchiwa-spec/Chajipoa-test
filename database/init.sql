-- database/init.sql
-- Initial database schema for CHAJIPOA

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    national_id VARCHAR(50),
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    user_type VARCHAR(20) DEFAULT 'regular',
    account_status VARCHAR(20) DEFAULT 'active',
    deposit_balance DECIMAL(10,2) DEFAULT 0.00,
    total_rentals INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0.00,
    blacklist_reason TEXT,
    blacklisted_at TIMESTAMP,
    password_hash VARCHAR(255),
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_code VARCHAR(50) UNIQUE NOT NULL,
    qr_code_url TEXT,
    station_id UUID,
    current_status VARCHAR(20) DEFAULT 'available',
    battery_level INTEGER DEFAULT 100,
    health_score INTEGER DEFAULT 100,
    last_maintenance_date TIMESTAMP,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    warranty_until TIMESTAMP,
    rental_count INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    last_known_latitude DECIMAL(10,8),
    last_known_longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stations table
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location_type VARCHAR(50) DEFAULT 'bus_terminal',
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    total_slots INTEGER DEFAULT 10,
    available_slots INTEGER DEFAULT 10,
    is_operational BOOLEAN DEFAULT true,
    has_power_backup BOOLEAN DEFAULT false,
    has_solar BOOLEAN DEFAULT false,
    installation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create rentals table
CREATE TABLE IF NOT EXISTS rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_code VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    device_id UUID REFERENCES devices(id),
    station_from_id UUID REFERENCES stations(id),
    station_to_id UUID REFERENCES stations(id),
    rental_status VARCHAR(20) DEFAULT 'active',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    expected_end_time TIMESTAMP,
    total_hours DECIMAL(5,2),
    base_amount DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    deposit_amount DECIMAL(10,2) DEFAULT 0.00,
    late_fee DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    deposit_returned BOOLEAN DEFAULT false,
    deposit_return_amount DECIMAL(10,2) DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    qr_code_used VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id UUID REFERENCES rentals(id),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50),
    provider_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_rental ON transactions(rental_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Add revenue tracking to stations
ALTER TABLE stations ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS total_rentals INTEGER DEFAULT 0;

-- Create rental statistics view
CREATE OR REPLACE VIEW rental_statistics AS
SELECT 
    DATE(r.start_time) as rental_date,
    COUNT(*) as total_rentals,
    SUM(r.total_amount) as total_revenue,
    AVG(r.total_hours) as avg_rental_hours,
    COUNT(DISTINCT r.user_id) as unique_users,
    s.city,
    EXTRACT(HOUR FROM r.start_time) as hour_of_day
FROM rentals r
LEFT JOIN stations s ON r.station_from_id = s.id
WHERE r.rental_status = 'completed'
GROUP BY DATE(r.start_time), s.city, EXTRACT(HOUR FROM r.start_time);

-- Create device performance view
CREATE OR REPLACE VIEW device_performance AS
SELECT 
    d.device_code,
    d.station_id,
    s.name as station_name,
    d.rental_count,
    d.total_earnings,
    d.health_score,
    d.battery_level,
    CASE 
        WHEN d.health_score >= 90 THEN 'Excellent'
        WHEN d.health_score >= 75 THEN 'Good'
        WHEN d.health_score >= 60 THEN 'Fair'
        ELSE 'Poor'
    END as health_status,
    ROUND(d.total_earnings / NULLIF(d.rental_count, 0), 2) as avg_earning_per_rental
FROM devices d
LEFT JOIN stations s ON d.station_id = s.id
WHERE d.is_active = true;

-- Insert default station data
INSERT INTO stations (station_code, name, location_type, address, city, region, latitude, longitude) 
VALUES 
    ('STN001', 'Dar Es Salaam Bus Terminal', 'bus_terminal', 'Kivukoni, Dar es Salaam', 'Dar es Salaam', 'Dar es Salaam', -6.7924, 39.2083),
    ('STN002', 'Mlimani City Mall', 'shopping_mall', 'Mlimani, Dar es Salaam', 'Dar es Salaam', 'Dar es Salaam', -6.7866, 39.2171),
    ('STN003', 'Airport Station', 'airport', 'Julius Nyerere International Airport', 'Dar es Salaam', 'Dar es Salaam', -6.8792, 39.2026)
ON CONFLICT (station_code) DO NOTHING;