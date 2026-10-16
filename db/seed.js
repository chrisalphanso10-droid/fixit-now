/**
 * FixIt Now - Database Seeder
 * Conforms to docs/SRS.md and Phase 1 of docs/PLAN.md:
 * - One admin account (email and password read from .env)
 * - 5 Service categories (Electrician, Plumber, Carpenter, AC repair, Appliance repair)
 * - 3 Subscription plans (quarterly, half-yearly, yearly with longer = cheaper per month)
 * - 4 Demo partners at different areas with coordinates
 * - Subscriptions and KYC documents for demo partners
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env or .env
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });
dotenv.config();

const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function runSeed() {
  const client = await pool.connect();
  console.log('Connected to PostgreSQL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

  try {
    await client.query('BEGIN');

    // =========================================================================
    // 1. ADMIN ACCOUNT (from .env)
    // =========================================================================
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@fixitnow.com').trim().toLowerCase();
    const adminPlainPassword = process.env.ADMIN_PASSWORD || 'admin@123';
    const adminPasswordHash = await bcrypt.hash(adminPlainPassword, 10);

    console.log(`Seeding Admin account: ${adminEmail}`);
    await client.query(
      `
      INSERT INTO admins (email, password_hash, name, updated_at)
      VALUES ($1, $2, 'Platform Admin', CURRENT_TIMESTAMP)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = CURRENT_TIMESTAMP;
      `,
      [adminEmail, adminPasswordHash]
    );

    // Also seed admin@fixitnow.local (Admin@2026) for local UI autofill convenience
    const localAdminHash = await bcrypt.hash('Admin@2026', 10);
    await client.query(
      `
      INSERT INTO admins (email, password_hash, name, updated_at)
      VALUES ('admin@fixitnow.local', $1, 'FixIt Now Central Controller', CURRENT_TIMESTAMP)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = CURRENT_TIMESTAMP;
      `,
      [localAdminHash]
    );

    // Seed Demo Customer (Ananya Rao)
    console.log('Seeding Demo Customer: ananya@example.com');
    const customerPasswordHash = await bcrypt.hash('FixIt@2026', 10);
    await client.query(
      `
      INSERT INTO customers (name, email, password_hash, phone, address, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address;
      `,
      [
        'Ananya Rao',
        'ananya@example.com',
        customerPasswordHash,
        '+91 98765 43210',
        '42, 3rd Cross, Indiranagar, Bengaluru, 560038',
        12.9784,
        77.6408,
      ]
    );


    // =========================================================================
    // 2. 5 SERVICE CATEGORIES
    // =========================================================================
    console.log('Seeding 5 Service Categories...');
    const servicesData = [
      {
        name: 'Electrician',
        slug: 'electrician',
        description:
          'Switchboard fixes, short circuit troubleshooting, wiring inspection and fan installations.',
        base_price_estimate: 350.0,
      },
      {
        name: 'Plumber',
        slug: 'plumber',
        description:
          'Leaking pipe repairs, tap installations, drain unclogging and bathroom fitting fixes.',
        base_price_estimate: 300.0,
      },
      {
        name: 'Carpenter',
        slug: 'carpenter',
        description:
          'Door hinges, lock replacements, furniture repairs and cabinet hardware fixes.',
        base_price_estimate: 400.0,
      },
      {
        name: 'AC repair',
        slug: 'ac-repair',
        description:
          'Filter cleaning, cooling diagnostics, gas top-up and condenser unit troubleshooting.',
        base_price_estimate: 550.0,
      },
      {
        name: 'Appliance repair',
        slug: 'appliance-repair',
        description:
          'Washing machine motor checks, microwave heating repair, refrigerator cooling diagnostics.',
        base_price_estimate: 450.0,
      },
    ];

    const serviceMap = {};
    for (const s of servicesData) {
      const res = await client.query(
        `
        INSERT INTO services (name, slug, description, base_price_estimate, active, updated_at)
        VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          base_price_estimate = EXCLUDED.base_price_estimate,
          active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, slug, name;
        `,
        [s.name, s.slug, s.description, s.base_price_estimate]
      );
      serviceMap[s.slug] = res.rows[0].id;
    }

    // =========================================================================
    // 3. THREE SUBSCRIPTION PLANS (Longer = Cheaper per month per BR-2 / FR-P2)
    // =========================================================================
    console.log('Seeding 3 Subscription Plans...');
    // Quarterly (3 mo): 899.00 (~299.67/mo)
    // Half-yearly (6 mo): 1599.00 (~266.50/mo)
    // Yearly (12 mo): 2799.00 (~233.25/mo)
    const plansData = [
      { name: 'quarterly', duration_months: 3, price: 899.0 },
      { name: 'half-yearly', duration_months: 6, price: 1599.0 },
      { name: 'yearly', duration_months: 12, price: 2799.0 },
    ];

    const planMap = {};
    for (const p of plansData) {
      const res = await client.query(
        `
        INSERT INTO plans (name, duration_months, price, active, updated_at)
        VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
        ON CONFLICT (name)
        DO UPDATE SET
          duration_months = EXCLUDED.duration_months,
          price = EXCLUDED.price,
          active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, price;
        `,
        [p.name, p.duration_months, p.price]
      );
      planMap[p.name] = res.rows[0].id;
    }

    // =========================================================================
    // 4. 4 DEMO PARTNERS AT DIFFERENT AREAS WITH COORDINATES
    // =========================================================================
    console.log('Seeding 4 Demo Partners with Coordinates and Statuses...');
    const partnerPasswordHash = await bcrypt.hash('Partner@2026', 10);

    const partnersData = [
      {
        name: 'Rajesh Kumar',
        email: 'rajesh@example.com',
        phone: '+91 98450 11223',
        address: 'Shop 4, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
        service_slug: 'plumber',
        online: true,
        latitude: 12.974,
        longitude: 77.635,
        kyc_status: 'verified',
        rejection_reason: null,
        rating: 4.9,
        total_jobs: 142,
        badge: 'Certified Master Plumber',
        vehicle: 'Bajaj Pulsar (KA-03-HJ-4421)',
        plan_name: 'quarterly',
      },
      {
        name: 'Ramesh Sharma',
        email: 'ramesh.electric@fixitnow.local',
        phone: '+91 97410 99881',
        address: '88, 100ft Road, Defence Colony, Indiranagar, Bengaluru 560038',
        service_slug: 'electrician',
        online: true,
        latitude: 12.981,
        longitude: 77.645,
        kyc_status: 'verified',
        rejection_reason: null,
        rating: 4.85,
        total_jobs: 98,
        badge: 'Licensed Wireman Grade 1',
        vehicle: 'Hero Splendor (KA-04-EK-9812)',
        plan_name: 'yearly',
      },
      {
        name: 'Sunil Mistry',
        email: 'sunil.carpenter@fixitnow.local',
        phone: '+91 94480 33445',
        address: '23, Old Madras Road, Ulsoor, Bengaluru 560008',
        service_slug: 'carpenter',
        online: false,
        latitude: 12.9755,
        longitude: 77.643,
        kyc_status: 'pending',
        rejection_reason: null,
        rating: 4.92,
        total_jobs: 116,
        badge: 'Master Wood Craftsman',
        vehicle: 'TVS Jupiter (KA-01-AB-1234)',
        plan_name: 'half-yearly',
      },
      {
        name: 'Vikram Joshi',
        email: 'vikram.appliance@fixitnow.local',
        phone: '+91 98860 77122',
        address: '14, CMH Road, Indiranagar, Bengaluru 560038',
        service_slug: 'appliance-repair',
        online: false,
        latitude: 12.979,
        longitude: 77.639,
        kyc_status: 'rejected',
        rejection_reason:
          'Trade license certificate expired in 2025. Please upload a valid certificate or renewal acknowledgment.',
        rating: 4.88,
        total_jobs: 84,
        badge: 'OEM Certified Technician',
        vehicle: 'Honda Activa (KA-05-MN-5567)',
        plan_name: 'quarterly',
      },
    ];

    for (const p of partnersData) {
      const serviceId = serviceMap[p.service_slug];
      const partnerRes = await client.query(
        `
        INSERT INTO partners (
          name, email, password_hash, phone, address,
          service_id, online, latitude, longitude,
          kyc_status, rejection_reason, rating, total_jobs,
          badge, vehicle, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
        ON CONFLICT (email)
        DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          service_id = EXCLUDED.service_id,
          online = EXCLUDED.online,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          kyc_status = EXCLUDED.kyc_status,
          rejection_reason = EXCLUDED.rejection_reason,
          rating = EXCLUDED.rating,
          total_jobs = EXCLUDED.total_jobs,
          badge = EXCLUDED.badge,
          vehicle = EXCLUDED.vehicle,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, email;
        `,
        [
          p.name,
          p.email,
          partnerPasswordHash,
          p.phone,
          p.address,
          serviceId,
          p.online,
          p.latitude,
          p.longitude,
          p.kyc_status,
          p.rejection_reason,
          p.rating,
          p.total_jobs,
          p.badge,
          p.vehicle,
        ]
      );

      const partnerId = partnerRes.rows[0].id;
      const planId = planMap[p.plan_name];

      // Seed an active subscription for each demo partner
      await client.query(
        `
        INSERT INTO subscriptions (
          partner_id, plan_id, price_paid, start_date, end_date, status
        )
        VALUES (
          $1, $2,
          (SELECT price FROM plans WHERE id = $2),
          CURRENT_TIMESTAMP - INTERVAL '15 days',
          CURRENT_TIMESTAMP + INTERVAL '75 days',
          'active'
        )
        ON CONFLICT DO NOTHING;
        `,
        [partnerId, planId]
      );

      // Seed a sample KYC document record
      const reviewerNotes =
        p.kyc_status === 'rejected'
          ? 'Trade license expired in 2025. Please upload a valid certificate or renewal acknowledgment.'
          : 'Self-attested government identity and trade certificate.';

      await client.query(
        `
        INSERT INTO kyc_documents (
          partner_id, document_type, file_path, file_type, status, reviewer_notes
        )
        VALUES (
          $1, 'aadhaar_id', 'uploads/kyc/sample-aadhaar.pdf', 'application/pdf', $2, $3
        );
        `,
        [partnerId, p.kyc_status, reviewerNotes]
      );
    }

    // =========================================================================
    // 5. SEED INITIAL ACTIVITY LOG
    // =========================================================================
    await client.query(`
      INSERT INTO activity_logs (actor, action, details)
      VALUES (
        'SYSTEM',
        'Database initialized and seeded with Phase 1 baseline entities',
        '{"services_count": 5, "plans_count": 3, "demo_partners_count": 4}'::jsonb
      );
    `);

    await client.query('COMMIT');
    console.log('✓ FixIt Now database seed completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database seed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed().catch((err) => {
  console.error(err);
  process.exit(1);
});
