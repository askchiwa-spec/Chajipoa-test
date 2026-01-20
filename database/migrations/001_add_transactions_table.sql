-- Add to your existing init.sql or create new migration
-- database/migrations/001_add_transactions_table.sql
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