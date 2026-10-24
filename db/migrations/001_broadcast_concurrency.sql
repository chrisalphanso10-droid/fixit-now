-- FixIt Now Migration 001: Broadcast Concurrency & Active Partner Constraint
-- Conforms to Item 1 Concurrency Requirements

-- 1. Ensure 'searching' is in requests status check constraint and set as default
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check CHECK (
    status IN (
        'requested',
        'searching',
        'accepted',
        'partner_on_way',
        'partner_arrived',
        'service_started',
        'service_completed',
        'payment_completed',
        'cancelled'
    )
);

ALTER TABLE requests ALTER COLUMN status SET DEFAULT 'searching';

-- 2. Add unique partial index so a partner can never have more than one active job at the database level
-- Active job statuses per SRS / Item 1: 'accepted', 'partner_on_way', 'partner_arrived', 'service_started'
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_active_partner ON requests (partner_id)
WHERE partner_id IS NOT NULL AND status IN ('accepted', 'partner_on_way', 'partner_arrived', 'service_started');

-- 3. Composite index for customer request deduplication within time window
CREATE INDEX IF NOT EXISTS idx_requests_customer_service_created ON requests (customer_id, service_id, created_at);
