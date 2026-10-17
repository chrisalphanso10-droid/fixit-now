/**
 * FixIt Now - Demo Seed Command (Phase 10)
 * Resets the database with demo partners at real nearby areas,
 * all online, verified, subscribed, and ready for immediate demo matching.
 *
 * Conforms to docs/PLAN.md Section 7 (Demo Checklist) and docs/SRS.md.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../server/.env') });
dotenv.config();

const { Pool } = pg;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function runDemoSeed() {
  const client = await pool.connect();
  console.log('===============================================================');
  console.log('FixIt Now - Resetting Database with Clean Demo State (Phase 10)');
  console.log('===============================================================');

  try {
    await client.query('BEGIN');

    // 1. Reset active requests & logs so all partners are available for matching
    console.log('1. Clearing active requests and temporary dispatch logs...');
    await client.query(`
      DELETE FROM request_status_logs WHERE request_id IN (
        SELECT id FROM requests WHERE status IN ('requested', 'accepted', 'partner_on_way', 'partner_arrived', 'service_started')
      );
    `);
    await client.query(`
      DELETE FROM requests WHERE status IN ('requested', 'accepted', 'partner_on_way', 'partner_arrived', 'service_started');
    `);
    // Also clean up any transient test accounts from prior automated test runs
    await client.query(`
      DELETE FROM request_status_logs WHERE request_id IN (
        SELECT id FROM requests WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE 'demo_customer_%' OR email LIKE 'testcust_%')
      );
      DELETE FROM requests WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE 'demo_customer_%' OR email LIKE 'testcust_%');
      DELETE FROM requests WHERE partner_id IN (SELECT id FROM partners WHERE email LIKE 'demo_partner_%' OR email LIKE 'testpartner_%');
      DELETE FROM ratings WHERE partner_id IN (SELECT id FROM partners WHERE email LIKE 'demo_partner_%' OR email LIKE 'testpartner_%');
      DELETE FROM kyc_documents WHERE partner_id IN (SELECT id FROM partners WHERE email LIKE 'demo_partner_%' OR email LIKE 'testpartner_%');
      DELETE FROM subscriptions WHERE partner_id IN (SELECT id FROM partners WHERE email LIKE 'demo_partner_%' OR email LIKE 'testpartner_%');
      DELETE FROM partners WHERE email LIKE 'demo_partner_%' OR email LIKE 'testpartner_%';
      DELETE FROM customers WHERE email LIKE 'demo_customer_%' OR email LIKE 'testcust_%';
    `);

    // 2. Admin Accounts
    console.log('2. Ensuring Admin accounts are ready...');
    const adminPlainPassword = process.env.ADMIN_PASSWORD || 'admin@123';
    const adminPasswordHash = await bcrypt.hash(adminPlainPassword, 10);
    const localAdminHash = await bcrypt.hash('Admin@2026', 10);

    await client.query(
      `
      INSERT INTO admins (email, password_hash, name, updated_at)
      VALUES ($1, $2, 'Platform Admin', CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
      `,
      [(process.env.ADMIN_EMAIL || 'admin@fixitnow.com').trim().toLowerCase(), adminPasswordHash]
    );

    await client.query(
      `
      INSERT INTO admins (email, password_hash, name, updated_at)
      VALUES ('admin@fixitnow.local', $1, 'FixIt Now Central Controller', CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
      `,
      [localAdminHash]
    );

    // 3. Demo Customer (Ananya Rao in Indiranagar)
    console.log('3. Ensuring Demo Customer (ananya@example.com) is ready...');
    const customerPasswordHash = await bcrypt.hash('Password@123', 10);
    await client.query(
      `
      INSERT INTO customers (name, email, password_hash, phone, address, latitude, longitude)
      VALUES ('Ananya Rao', 'ananya@example.com', $1, '+91 98765 43210', '42, 100ft Road, Indiranagar, Bengaluru, 560038', 12.9784, 77.6408)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude;
      `,
      [customerPasswordHash]
    );

    // Also support customer@fixitnow.local
    await client.query(
      `
      INSERT INTO customers (name, email, password_hash, phone, address, latitude, longitude)
      VALUES ('Customer Demo', 'customer@fixitnow.local', $1, '+91 98765 11223', '77, 12th Cross, Indiranagar 2nd Stage, Bengaluru', 12.9715, 77.6405)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
      `,
      [customerPasswordHash]
    );

    // 4. Services (IDs: 1 to 5)
    console.log('4. Verifying 5 service trades...');
    const services = [
      { name: 'Electrician', slug: 'electrician', desc: 'Wiring, fixtures, switches, circuit breakers.', price: 350.0 },
      { name: 'Plumber', slug: 'plumber', desc: 'Leaking pipe repairs, tap installations, drain unclogging.', price: 300.0 },
      { name: 'Carpenter', slug: 'carpenter', desc: 'Door alignment, lock replacements, furniture repair.', price: 400.0 },
      { name: 'Appliance repair', slug: 'appliance-repair', desc: 'Washing machines, microwave ovens, water purifiers, refrigerators.', price: 450.0 },
      { name: 'AC repair', slug: 'ac-repair', desc: 'Filter cleaning, cooling diagnostics, gas top-up.', price: 550.0 },
    ];

    const serviceMap = {};
    for (const s of services) {
      const res = await client.query(
        `INSERT INTO services (name, slug, description, base_price_estimate, active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (slug) DO UPDATE SET active = true, name = EXCLUDED.name, base_price_estimate = EXCLUDED.base_price_estimate
         RETURNING id`,
        [s.name, s.slug, s.desc, s.price]
      );
      serviceMap[s.slug] = res.rows[0].id;
    }

    // 5. Subscription Plans
    console.log('5. Verifying subscription plans...');
    const plansData = [
      { name: 'quarterly', duration: 3, price: 899.0 },
      { name: 'half-yearly', duration: 6, price: 1599.0 },
      { name: 'yearly', duration: 12, price: 2799.0 },
    ];
    const planMap = {};
    for (const p of plansData) {
      const res = await client.query(
        `INSERT INTO plans (name, duration_months, price, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name) DO UPDATE SET active = true, price = EXCLUDED.price
         RETURNING id`,
        [p.name, p.duration, p.price]
      );
      planMap[p.name] = res.rows[0].id;
    }

    // 6. Demo Partners at Real Nearby Areas (ALL ONLINE AND VERIFIED)
    console.log('6. Seeding Demo Partners at real nearby areas (ALL ONLINE & VERIFIED)...');
    const partnerPasswordHash = await bcrypt.hash('Password@123', 10);

    const demoPartners = [
      {
        name: 'Rajesh Kumar',
        email: 'rajesh.plumber@fixitnow.local',
        phone: '+91 98450 12345',
        address: '42, 100ft Road, Indiranagar, Bengaluru 560038',
        service_slug: 'plumber',
        lat: 12.9784,
        lon: 77.6408,
        rating: 4.95,
        total_jobs: 142,
        badge: 'Master Plumber Certified',
        vehicle: 'Bajaj Pulsar 150 (KA-03-HA-1234)',
        plan: 'yearly',
      },
      {
        name: 'Ramesh Sharma',
        email: 'ramesh.electrician@fixitnow.local',
        phone: '+91 98230 44556',
        address: '12th Main Road, Indiranagar, Bengaluru 560038',
        service_slug: 'electrician',
        lat: 12.9715,
        lon: 77.6405,
        rating: 4.90,
        total_jobs: 94,
        badge: 'Licensed Wireman Grade 1',
        vehicle: 'Hero Splendor (KA-04-EK-9821)',
        plan: 'half-yearly',
      },
      {
        name: 'Sunil Mistry',
        email: 'sunil.carpenter@fixitnow.local',
        phone: '+91 94480 33445',
        address: '23, Old Madras Road, Ulsoor, Bengaluru 560008',
        service_slug: 'carpenter',
        lat: 12.9755,
        lon: 77.6430,
        rating: 4.92,
        total_jobs: 116,
        badge: 'Master Wood Craftsman',
        vehicle: 'TVS Jupiter (KA-01-AB-1234)',
        plan: 'quarterly',
      },
      {
        name: 'Vikram Joshi',
        email: 'vikram.appliance@fixitnow.local',
        phone: '+91 98860 77122',
        address: '14, CMH Road, Indiranagar, Bengaluru 560038',
        service_slug: 'appliance-repair',
        lat: 12.9790,
        lon: 77.6390,
        rating: 4.88,
        total_jobs: 84,
        badge: 'OEM Certified Technician',
        vehicle: 'Honda Activa (KA-05-MN-5567)',
        plan: 'yearly',
      },
      {
        name: 'Kiran Patel',
        email: 'kiran.ac@fixitnow.local',
        phone: '+91 98220 55431',
        address: '56, 1st Cross, Domlur Layout, Bengaluru 560071',
        service_slug: 'ac-repair',
        lat: 12.9680,
        lon: 77.6380,
        rating: 4.94,
        total_jobs: 156,
        badge: 'HVAC Specialist Grade A',
        vehicle: 'Suzuki Access (KA-04-TR-4431)',
        plan: 'half-yearly',
      },
    ];

    for (const p of demoPartners) {
      const serviceId = serviceMap[p.service_slug];
      const pRes = await client.query(
        `
        INSERT INTO partners (
          name, email, password_hash, phone, address,
          service_id, online, latitude, longitude,
          kyc_status, rating, total_jobs, badge, vehicle, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, 'verified', $9, $10, $11, $12, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO UPDATE SET
          online = true,
          kyc_status = 'verified',
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          rating = EXCLUDED.rating,
          total_jobs = EXCLUDED.total_jobs,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
        `,
        [
          p.name,
          p.email,
          partnerPasswordHash,
          p.phone,
          p.address,
          serviceId,
          p.lat,
          p.lon,
          p.rating,
          p.total_jobs,
          p.badge,
          p.vehicle,
        ]
      );

      const partnerId = pRes.rows[0].id;
      const planId = planMap[p.plan];
      const planPrice = plansData.find((pl) => pl.name === p.plan)?.price || 899.0;

      // Ensure active subscription with plenty of days remaining (90 days forward)
      await client.query(
        `
        INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '90 days', 'active')
        ON CONFLICT DO NOTHING;
        `,
        [partnerId, planId, planPrice]
      );

      // Ensure verified KYC document record
      await client.query(
        `
        INSERT INTO kyc_documents (partner_id, document_type, file_path, file_type, status, reviewer_notes)
        VALUES ($1, 'aadhaar_id', 'uploads/kyc/sample-aadhaar.pdf', 'application/pdf', 'verified', 'Verified Government ID and Trade License.')
        ON CONFLICT DO NOTHING;
        `,
        [partnerId]
      );

      console.log(`   ✓ Partner ready: ${p.name} (${p.service_slug}) @ ${p.address} [ONLINE & VERIFIED]`);
    }

    // 7. Seed 1 partner in a pending KYC state for demo scenario #2 admin verification
    console.log('7. Seeding 1 pending partner for KYC review walkthrough...');
    const pendingRes = await client.query(
      `
      INSERT INTO partners (
        name, email, password_hash, phone, address,
        service_id, online, latitude, longitude,
        kyc_status, rating, total_jobs, badge, vehicle
      ) VALUES (
        'Arun Prakash', 'arun.plumber@fixitnow.local', $1, '+91 97411 99887',
        '88, 14th Main, HAL 2nd Stage, Indiranagar, Bengaluru',
        $2, false, 12.9730, 77.6440,
        'pending', 5.0, 0, 'Plumbing Apprentice', 'Hero Splendor (KA-03-PL-8899)'
      )
      ON CONFLICT (email) DO UPDATE SET kyc_status = 'pending', online = false
      RETURNING id
      `,
      [partnerPasswordHash, serviceMap['plumber']]
    );
    const pendingPartnerId = pendingRes.rows[0].id;
    await client.query(
      `
      INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status)
      VALUES ($1, $2, 899.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '90 days', 'active')
      ON CONFLICT DO NOTHING;
      `,
      [pendingPartnerId, planMap['quarterly']]
    );
    await client.query(
      `
      INSERT INTO kyc_documents (partner_id, document_type, file_path, file_type, status, reviewer_notes)
      VALUES ($1, 'aadhaar_id', 'uploads/kyc/sample-aadhaar.pdf', 'application/pdf', 'pending', 'Under initial verification queue.')
      ON CONFLICT DO NOTHING;
      `,
      [pendingPartnerId]
    );
    console.log('   ✓ Pending Partner ready for Admin KYC approval: Arun Prakash');

    await client.query('COMMIT');
    console.log('\n===============================================================');
    console.log('✅ DEMO SEED COMPLETED SUCCESSFULLY!');
    console.log('All demo partners in Indiranagar are ONLINE, VERIFIED and READY.');
    console.log('Demo Checklist scenarios 1-8 are fully primed to run.');
    console.log('===============================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Demo seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runDemoSeed().catch((e) => {
  console.error(e);
  process.exit(1);
});
