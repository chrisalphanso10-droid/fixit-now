-- FixIt Now - Migration 003: Payment Attempts & Subscription Link
-- Conforms to Item 3: QR Code Demo Subscription Payments

CREATE TABLE IF NOT EXISTS payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'processing', 'paid', 'expired', 'cancelled')),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_partner_plan ON payment_attempts(partner_id, plan_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_token_hash ON payment_attempts(token_hash);

-- Add unique idempotent link from subscriptions to payment_attempts
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_attempt_id UUID UNIQUE REFERENCES payment_attempts(id);
