CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    national_id VARCHAR(50) UNIQUE,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    user_type VARCHAR(20) DEFAULT 'regular',
    account_status VARCHAR(20) DEFAULT 'active',
    deposit_balance DECIMAL(12,2) DEFAULT 0.00,
    total_rentals INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0.00,
    blacklist_reason TEXT,
    blacklisted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_status ON users(account_status);

-- Stations table
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location_type VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    total_slots INTEGER NOT NULL,
    available_slots INTEGER DEFAULT 0,
    is_operational BOOLEAN DEFAULT TRUE,
    has_power_backup BOOLEAN DEFAULT FALSE,
    has_solar BOOLEAN DEFAULT FALSE,
    installation_date DATE,
    last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stations_city ON stations(city);
CREATE INDEX idx_stations_operational ON stations(is_operational);

-- Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_code VARCHAR(50) UNIQUE NOT NULL,
    qr_code_url VARCHAR(500),
    station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    current_status VARCHAR(20) DEFAULT 'available',
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    health_score INTEGER DEFAULT 100,
    last_maintenance_date DATE,
    purchase_date DATE NOT NULL,
    warranty_until DATE,
    rental_count INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    last_known_latitude DECIMAL(10,8),
    last_known_longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_devices_status ON devices(current_status);
CREATE INDEX idx_devices_station ON devices(station_id);

-- Rentals table
CREATE TABLE rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_code VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    device_id UUID REFERENCES devices(id) NOT NULL,
    station_from_id UUID REFERENCES stations(id),
    station_to_id UUID REFERENCES stations(id),
    rental_status VARCHAR(20) DEFAULT 'active',
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
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    qr_code_used VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rentals_user ON rentals(user_id);
CREATE INDEX idx_rentals_device ON rentals(device_id);
CREATE INDEX idx_rentals_status ON rentals(rental_status);
CREATE INDEX idx_rentals_payment_status ON rentals(payment_status);