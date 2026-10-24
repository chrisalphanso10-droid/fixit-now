-- Migration 002: Add terms and conditions acceptance columns to customers and partners
-- Conforms to ITEM 2 requirements

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);

ALTER TABLE partners
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);
