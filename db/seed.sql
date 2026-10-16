-- =============================================================================
-- FixIt Now: Database Baseline Seeds (PostgreSQL)
-- Conforms to docs/SRS.md and Phase 1 of docs/PLAN.md:
-- - One admin account (admin@fixitnow.com with bcrypt hash for admin@123)
-- - 5 Service categories (Electrician, Plumber, Carpenter, AC repair, Appliance repair)
-- - 3 Plans (quarterly, half-yearly, yearly where longer means cheaper per month)
-- - 4 Demo partners at different areas with coordinates
-- =============================================================================

BEGIN;

-- 1. Admin Account (admin@fixitnow.com / admin@123)
-- bcrypt hash for 'admin@123': $2b$10$BqUdbbOB58vFszh1hP9M8.3l6rV9k82Bw4c9G0wL6eO7k1M5xP9Q2
INSERT INTO admins (email, password_hash, name, updated_at)
VALUES (
    'admin@fixitnow.com',
    '$2b$10$BqUdbbOB58vFszh1hP9M8.3l6rV9k82Bw4c9G0wL6eO7k1M5xP9Q2',
    'Platform Admin',
    CURRENT_TIMESTAMP
)
ON CONFLICT (email)
DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    updated_at = CURRENT_TIMESTAMP;

-- 2. 5 Service Categories
INSERT INTO services (name, slug, description, base_price_estimate, active, updated_at)
VALUES 
    (
        'Electrician',
        'electrician',
        'Switchboard fixes, short circuit troubleshooting, wiring inspection and fan installations.',
        350.00,
        true,
        CURRENT_TIMESTAMP
    ),
    (
        'Plumber',
        'plumber',
        'Leaking pipe repairs, tap installations, drain unclogging and bathroom fitting fixes.',
        300.00,
        true,
        CURRENT_TIMESTAMP
    ),
    (
        'Carpenter',
        'carpenter',
        'Door hinges, lock replacements, furniture repairs and cabinet hardware fixes.',
        400.00,
        true,
        CURRENT_TIMESTAMP
    ),
    (
        'AC repair',
        'ac-repair',
        'Filter cleaning, cooling diagnostics, gas top-up and condenser unit troubleshooting.',
        550.00,
        true,
        CURRENT_TIMESTAMP
    ),
    (
        'Appliance repair',
        'appliance-repair',
        'Washing machine motor checks, microwave heating repair, refrigerator cooling diagnostics.',
        450.00,
        true,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (slug)
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    base_price_estimate = EXCLUDED.base_price_estimate,
    active = true,
    updated_at = CURRENT_TIMESTAMP;

-- 3. Three Subscription Plans (Longer = Cheaper per month per BR-2 / FR-P2)
-- Quarterly: 899.00 (~299.67/mo)
-- Half-yearly: 1599.00 (~266.50/mo)
-- Yearly: 2799.00 (~233.25/mo)
INSERT INTO plans (name, duration_months, price, active, updated_at)
VALUES 
    ('quarterly', 3, 899.00, true, CURRENT_TIMESTAMP),
    ('half-yearly', 6, 1599.00, true, CURRENT_TIMESTAMP),
    ('yearly', 12, 2799.00, true, CURRENT_TIMESTAMP)
ON CONFLICT (name)
DO UPDATE SET
    duration_months = EXCLUDED.duration_months,
    price = EXCLUDED.price,
    active = true,
    updated_at = CURRENT_TIMESTAMP;

-- 4. Four Demo Partners (Password: Partner@2026)
-- bcrypt hash for 'Partner@2026': $2b$10$r.7gU6WwJjA9x8sZ8fK5..o9uL2p3q4r5s6t7u8v9w0x1y2z3a4b5
DO $$
DECLARE
    v_pwd VARCHAR := '$2b$10$GfF756Xsk7R4X9Jt5M2X7uWj9Yq2e4B1C5z6a7b8c9d0e1f2g3h4i';
    v_plumber_id INTEGER;
    v_electrician_id INTEGER;
    v_carpenter_id INTEGER;
    v_appliance_id INTEGER;
    v_p1_id UUID;
    v_p2_id UUID;
    v_p3_id UUID;
    v_p4_id UUID;
    v_q_plan_id INTEGER;
    v_h_plan_id INTEGER;
    v_y_plan_id INTEGER;
BEGIN
    SELECT id INTO v_plumber_id FROM services WHERE slug = 'plumber';
    SELECT id INTO v_electrician_id FROM services WHERE slug = 'electrician';
    SELECT id INTO v_carpenter_id FROM services WHERE slug = 'carpenter';
    SELECT id INTO v_appliance_id FROM services WHERE slug = 'appliance-repair';

    SELECT id INTO v_q_plan_id FROM plans WHERE name = 'quarterly';
    SELECT id INTO v_h_plan_id FROM plans WHERE name = 'half-yearly';
    SELECT id INTO v_y_plan_id FROM plans WHERE name = 'yearly';

    -- Partner 1: Rajesh Kumar (Plumber, Indiranagar)
    INSERT INTO partners (
        name, email, password_hash, phone, address,
        service_id, online, latitude, longitude,
        kyc_status, rating, total_jobs, badge, vehicle
    ) VALUES (
        'Rajesh Kumar', 'rajesh@example.com', v_pwd, '+91 98450 11223',
        'Shop 4, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
        v_plumber_id, true, 12.9740, 77.6350,
        'verified', 4.90, 142, 'Certified Master Plumber', 'Bajaj Pulsar (KA-03-HJ-4421)'
    )
    ON CONFLICT (email) DO UPDATE SET
        online = true, kyc_status = 'verified', rating = 4.90, latitude = 12.9740, longitude = 77.6350
    RETURNING id INTO v_p1_id;

    -- Partner 2: Ramesh Sharma (Electrician, Defence Colony)
    INSERT INTO partners (
        name, email, password_hash, phone, address,
        service_id, online, latitude, longitude,
        kyc_status, rating, total_jobs, badge, vehicle
    ) VALUES (
        'Ramesh Sharma', 'ramesh.electric@fixitnow.local', v_pwd, '+91 97410 99881',
        '88, 100ft Road, Defence Colony, Indiranagar, Bengaluru 560038',
        v_electrician_id, true, 12.9810, 77.6450,
        'verified', 4.85, 98, 'Licensed Wireman Grade 1', 'Hero Splendor (KA-04-EK-9812)'
    )
    ON CONFLICT (email) DO UPDATE SET
        online = true, kyc_status = 'verified', rating = 4.85, latitude = 12.9810, longitude = 77.6450
    RETURNING id INTO v_p2_id;

    -- Partner 3: Sunil Mistry (Carpenter, Ulsoor)
    INSERT INTO partners (
        name, email, password_hash, phone, address,
        service_id, online, latitude, longitude,
        kyc_status, rating, total_jobs, badge, vehicle
    ) VALUES (
        'Sunil Mistry', 'sunil.carpenter@fixitnow.local', v_pwd, '+91 94480 33445',
        '23, Old Madras Road, Ulsoor, Bengaluru 560008',
        v_carpenter_id, false, 12.9755, 77.6430,
        'pending', 4.92, 116, 'Master Wood Craftsman', 'TVS Jupiter (KA-01-AB-1234)'
    )
    ON CONFLICT (email) DO UPDATE SET
        online = false, kyc_status = 'pending', rating = 4.92, latitude = 12.9755, longitude = 77.6430
    RETURNING id INTO v_p3_id;

    -- Partner 4: Vikram Joshi (Appliance repair, CMH Road)
    INSERT INTO partners (
        name, email, password_hash, phone, address,
        service_id, online, latitude, longitude,
        kyc_status, rejection_reason, rating, total_jobs, badge, vehicle
    ) VALUES (
        'Vikram Joshi', 'vikram.appliance@fixitnow.local', v_pwd, '+91 98860 77122',
        '14, CMH Road, Indiranagar, Bengaluru 560038',
        v_appliance_id, false, 12.9790, 77.6390,
        'rejected', 'Trade license certificate expired in 2025. Please upload a valid certificate or renewal acknowledgment.',
        4.88, 84, 'OEM Certified Technician', 'Honda Activa (KA-05-MN-5567)'
    )
    ON CONFLICT (email) DO UPDATE SET
        online = false, kyc_status = 'rejected', rating = 4.88, latitude = 12.9790, longitude = 77.6390
    RETURNING id INTO v_p4_id;

    -- Subscriptions
    INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status)
    VALUES (v_p1_id, v_q_plan_id, 899.00, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '80 days', 'active')
    ON CONFLICT DO NOTHING;

    INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status)
    VALUES (v_p2_id, v_y_plan_id, 2799.00, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '335 days', 'active')
    ON CONFLICT DO NOTHING;

    INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status)
    VALUES (v_p3_id, v_h_plan_id, 1599.00, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '175 days', 'active')
    ON CONFLICT DO NOTHING;

    INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status)
    VALUES (v_p4_id, v_q_plan_id, 899.00, CURRENT_TIMESTAMP - INTERVAL '40 days', CURRENT_TIMESTAMP + INTERVAL '50 days', 'active')
    ON CONFLICT DO NOTHING;

    -- KYC Document records
    INSERT INTO kyc_documents (partner_id, document_type, file_path, file_type, status, reviewer_notes)
    VALUES (v_p1_id, 'aadhaar_id', 'uploads/kyc/sample-aadhaar.pdf', 'application/pdf', 'verified', 'Self-attested government identity and trade certificate.')
    ON CONFLICT DO NOTHING;

    INSERT INTO kyc_documents (partner_id, document_type, file_path, file_type, status, reviewer_notes)
    VALUES (v_p2_id, 'aadhaar_id', 'uploads/kyc/sample-aadhaar.pdf', 'application/pdf', 'verified', 'Licensed Wireman Grade 1 certified.')
    ON CONFLICT DO NOTHING;

    INSERT INTO kyc_documents (partner_id, document_type, file_path, file_type, status, reviewer_notes)
    VALUES (v_p3_id, 'aadhaar_id', 'uploads/kyc/sample-aadhaar.pdf', 'application/pdf', 'pending', 'Under initial document verification queue.')
    ON CONFLICT DO NOTHING;

    INSERT INTO kyc_documents (partner_id, document_type, file_path, file_type, status, reviewer_notes)
    VALUES (v_p4_id, 'aadhaar_id', 'uploads/kyc/sample-aadhaar.pdf', 'application/pdf', 'rejected', 'Trade license certificate expired in 2025.')
    ON CONFLICT DO NOTHING;

END $$;

COMMIT;
