-- ChajiPoa Database Schema
-- PostgreSQL Database Setup Script

-- Create database
CREATE DATABASE chajipoa_db;

-- Connect to database
\c chajipoa_db;

-- Extension for UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    national_id VARCHAR(50) UNIQUE,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    user_type VARCHAR(20) DEFAULT 'regular' CHECK (user_type IN ('regular', 'tourist', 'corporate')),
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'blocked')),
    deposit_balance DECIMAL(10,2) DEFAULT 0.00,
    total_rentals INT DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0.00,
    blacklist_reason TEXT,
    blacklisted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- Create indexes for users table
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_status ON users(account_status);
CREATE INDEX idx_users_type ON users(user_type);

-- Stations table
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location_type VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    gps_coordinates POINT,
    total_slots INT NOT NULL,
    available_slots INT DEFAULT 0,
    is_operational BOOLEAN DEFAULT TRUE,
    has_power_backup BOOLEAN DEFAULT FALSE,
    has_solar BOOLEAN DEFAULT FALSE,
    partner_id UUID,
    installation_date DATE,
    last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for stations table
CREATE INDEX idx_stations_city ON stations(city);
CREATE INDEX idx_stations_region ON stations(region);
CREATE INDEX idx_stations_location_type ON stations(location_type);
CREATE INDEX idx_stations_operational ON stations(is_operational);

-- Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_code VARCHAR(50) UNIQUE NOT NULL,
    qr_code_url VARCHAR(500),
    station_id UUID REFERENCES stations(id),
    current_status VARCHAR(20) DEFAULT 'available' CHECK (current_status IN ('available', 'rented', 'maintenance', 'lost')),
    battery_level INT CHECK (battery_level >= 0 AND battery_level <= 100),
    health_score INT DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    last_maintenance_date DATE,
    purchase_date DATE,
    warranty_until DATE,
    rental_count INT DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0.00,
    last_known_location POINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for devices table
CREATE INDEX idx_devices_status ON devices(current_status);
CREATE INDEX idx_devices_station ON devices(station_id);
CREATE INDEX idx_devices_code ON devices(device_code);

-- Rentals table
CREATE TABLE rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_code VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    device_id UUID REFERENCES devices(id) NOT NULL,
    station_from_id UUID REFERENCES stations(id),
    station_to_id UUID REFERENCES stations(id),
    rental_status VARCHAR(20) DEFAULT 'active' CHECK (rental_status IN ('active', 'completed', 'overdue', 'lost')),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    expected_end_time TIMESTAMP,
    total_hours DECIMAL(5,2),
    base_amount DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    deposit_amount DECIMAL(10,2),
    late_fee DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2),
    deposit_returned BOOLEAN DEFAULT FALSE,
    deposit_return_amount DECIMAL(10,2) DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    qr_code_used VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for rentals table
CREATE INDEX idx_rentals_user ON rentals(user_id);
CREATE INDEX idx_rentals_device ON rentals(device_id);
CREATE INDEX idx_rentals_status ON rentals(rental_status);
CREATE INDEX idx_rentals_payment_status ON rentals(payment_status);
CREATE INDEX idx_rentals_code ON rentals(rental_code);
CREATE INDEX idx_rentals_time_range ON rentals(start_time, end_time);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_code VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    rental_id UUID REFERENCES rentals(id),
    transaction_type VARCHAR(30) CHECK (transaction_type IN ('rental_payment', 'deposit_hold', 'deposit_return', 'refund', 'topup')),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TZS',
    payment_method VARCHAR(50),
    payment_provider VARCHAR(50),
    provider_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
    metadata JSONB,
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for transactions table
CREATE INDEX idx_transactions_user_type ON transactions(user_id, transaction_type);
CREATE INDEX idx_transactions_rental ON transactions(rental_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_provider_ref ON transactions(provider_reference);

-- Partners table (for station partners)
CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone_number VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance logs table
CREATE TABLE maintenance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id) NOT NULL,
    technician_name VARCHAR(255),
    maintenance_type VARCHAR(50) CHECK (maintenance_type IN ('routine', 'repair', 'replacement', 'upgrade')),
    description TEXT,
    cost DECIMAL(10,2),
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_maintenance_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rentals_updated_at BEFORE UPDATE ON rentals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO stations (station_code, name, location_type, city, region, total_slots, available_slots, is_operational) VALUES
('STN001', 'Dar es Salaam Central Station', 'BRT', 'Dar es Salaam', 'Coastal', 20, 15, TRUE),
('STN002', 'Arusha Airport Terminal', 'Airport', 'Arusha', 'Northern', 15, 12, TRUE),
('STN003', 'Mlimani City Mall', 'Mall', 'Dar es Salaam', 'Coastal', 25, 20, TRUE);

INSERT INTO partners (name, contact_person, phone_number, email, commission_rate) VALUES
('Dar Transport Ltd', 'John Smith', '+255712345678', 'john@dartransport.com', 15.00),
('Arusha Tourism Board', 'Sarah Johnson', '+255756789012', 'sarah@arushatourism.org', 12.00);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;