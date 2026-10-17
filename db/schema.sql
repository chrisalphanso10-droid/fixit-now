-- =============================================================================
-- FixIt Now: Relational Database Schema (PostgreSQL)
-- Conforms to docs/SRS.md Section 6 (Data Requirements) & docs/PLAN.md (Phase 1)
-- =============================================================================

-- Enable UUID extension if needed (gen_random_uuid() is native in PG 13+)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. Admins (Pre-created platform administrator - SRS Section 2.2, 3.4, 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL DEFAULT 'Platform Admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. Services (Marketplace service categories - SRS Section 3.1, 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    base_price_estimate NUMERIC(10, 2) DEFAULT 0.00,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 3. Customers (Service requesters - SRS FR-C1 to FR-C4, Section 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. Saved Addresses (Customer address book - SRS FR-C9, Section 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS saved_addresses (
    id SERIAL PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL, -- e.g. 'Home', 'Office', 'Parents'
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 5. Partners (Certified tradespeople offering 1 service - SRS FR-P1 to FR-P6, Sec 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    service_id INTEGER NOT NULL REFERENCES services(id),
    online BOOLEAN DEFAULT FALSE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    kyc_status VARCHAR(20) DEFAULT 'not_submitted' CHECK (kyc_status IN ('not_submitted', 'pending', 'verified', 'rejected')),
    rejection_reason TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    total_jobs INTEGER DEFAULT 0,
    photo_url TEXT,
    badge VARCHAR(100),
    vehicle VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 6. KYC Documents (Partner identity verification docs - SRS FR-P4, FR-P5, FR-A4)
-- =============================================================================
CREATE TABLE IF NOT EXISTS kyc_documents (
    id SERIAL PRIMARY KEY,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- e.g. 'document', 'photo', 'trade_cert', 'aadhaar', 'id_card', 'license'
    file_path TEXT NOT NULL,
    file_name VARCHAR(255),
    original_name VARCHAR(255),
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    reviewer_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 7. Subscription Plans (Quarterly, Half-yearly, Yearly - SRS FR-P2, BR-2, Sec 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE CHECK (name IN ('quarterly', 'half-yearly', 'yearly')),
    duration_months INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 8. Subscriptions (Partner subscription tenure & status - SRS FR-P3, BR-2, BR-4)
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    price_paid NUMERIC(10, 2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 9. Requests (Immediate job bookings - SRS FR-C6, FR-C10, FR-C14, FR-P9, Sec 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    partner_id UUID REFERENCES partners(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    problem VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    photo_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'requested' CHECK (
        status IN (
            'requested',
            'accepted',
            'partner_on_way',
            'partner_arrived',
            'service_started',
            'service_completed',
            'payment_completed',
            'cancelled'
        )
    ),
    cancel_reason TEXT,
    service_otp VARCHAR(6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 10. Request Status Log (Audit trail of job state ticks - SRS FR-T1, Section 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS request_status_logs (
    id SERIAL PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 11. Payments (Simulated customer-to-partner settlement - SRS FR-C18, BR-1, BR-7)
-- =============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'proceed' CHECK (status IN ('proceed', 'waiting', 'successful', 'failed')),
    receipt_no VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 12. Ratings (Customer reviews and stars for partner - SRS FR-C17, Section 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 13. Notifications (In-app alerts for users - SRS FR-C20, Section 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('customer', 'partner', 'admin')),
    recipient_id UUID,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    read_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 14. Activity Log (Admin auditability - SRS FR-A2, Section 5, Section 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    actor VARCHAR(100) NOT NULL,
    action VARCHAR(200) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 15. OTPs (One-Time Passwords for auth recovery & service - SRS FR-C4, FR-C16, Sec 6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS otps (
    id SERIAL PRIMARY KEY,
    target VARCHAR(255) NOT NULL, -- email or phone
    code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('forgot_password', 'service_otp')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES (Coordinates, Rapid Dispatch, Foreign Keys & Fast Status Queries)
-- =============================================================================

-- Coordinates Indexes for Rapid Haversine Distance Search (< 2 km radius)
CREATE INDEX IF NOT EXISTS idx_partners_coords ON partners(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_coords ON saved_addresses(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_requests_coords ON requests(latitude, longitude);

-- Partner dispatch filters: Online + KYC Verified + Service
CREATE INDEX IF NOT EXISTS idx_partners_online_kyc ON partners(online, kyc_status);
CREATE INDEX IF NOT EXISTS idx_partners_service ON partners(service_id);
CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);

-- Customer queries
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_customer ON saved_addresses(customer_id);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_partner ON subscriptions(partner_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Requests & Logs
CREATE INDEX IF NOT EXISTS idx_requests_customer ON requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_requests_partner ON requests(partner_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_service ON requests(service_id);
CREATE INDEX IF NOT EXISTS idx_request_status_logs_request ON request_status_logs(request_id);

-- KYC, Payments & Ratings
CREATE INDEX IF NOT EXISTS idx_kyc_documents_partner ON kyc_documents(partner_id);
CREATE INDEX IF NOT EXISTS idx_payments_request ON payments(request_id);
CREATE INDEX IF NOT EXISTS idx_ratings_partner ON ratings(partner_id);
CREATE INDEX IF NOT EXISTS idx_ratings_request ON ratings(request_id);

-- Notifications, OTPs & Activity Logs
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id, read_flag);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_otps_target_purpose ON otps(target, purpose);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
