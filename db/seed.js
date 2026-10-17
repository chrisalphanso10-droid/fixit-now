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
        subscription_status: 'active',
      },
      {
        name: 'Dinesh Nair',
        email: 'dinesh.mason@fixitnow.local',
        phone: '+91 98110 33211',
        address: '9, Cambridge Road, Ulsoor, Bengaluru',
        service_slug: 'plumber',
        online: false,
        latitude: 12.972,
        longitude: 77.641,
        kyc_status: 'verified',
        rejection_reason: null,
        rating: 4.79,
        total_jobs: 62,
        badge: 'Civil Tile & Masonry Pro',
        vehicle: 'Bajaj CT 100 (KA-05-YZ-9012)',
        plan_name: 'quarterly',
        subscription_status: 'expired',
      },
      {
        name: 'Mohan Sharma',
        email: 'naveen.lock@fixitnow.local',
        phone: '+91 97411 44556',
        address: '11, CMH Road, Stage 1, Indiranagar, Bengaluru',
        service_slug: 'electrician',
        online: false,
        latitude: 12.977,
        longitude: 77.636,
        kyc_status: 'pending',
        rejection_reason: null,
        rating: 4.88,
        total_jobs: 0,
        badge: 'Certified Apprentice Technician',
        vehicle: 'Bajaj Pulsar 150 (KA-03-LK-9122)',
        plan_name: null,
        subscription_status: null,
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

      // Seed subscription if configured
      if (p.plan_name && planMap[p.plan_name]) {
        const planId = planMap[p.plan_name];
        const isExp = p.subscription_status === 'expired';

        await client.query(
          `
          INSERT INTO subscriptions (
            partner_id, plan_id, price_paid, start_date, end_date, status
          )
          VALUES (
            $1, $2,
            (SELECT price FROM plans WHERE id = $2),
            $3, $4, $5
          )
          ON CONFLICT DO NOTHING;
          `,
          [
            partnerId,
            planId,
            isExp ? new Date(Date.now() - 120 * 86400000) : new Date(Date.now() - 15 * 86400000),
            isExp ? new Date(Date.now() - 30 * 86400000) : new Date(Date.now() + 75 * 86400000),
            isExp ? 'expired' : 'active',
          ]
        );
      }

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

    // =========================================================================
    // 6. PHASE 9: EXTENDED DEMO HISTORY FOR ADMIN ANALYTICS (FR-A7, FR-A2)
    // Seeds multi-month customer & partner cohorts, subscriptions, and requests
    // with peak hours, varied services, completion vs cancellation, and ratings.
    // =========================================================================
    console.log('Seeding Phase 9 Demo History for Admin Analytics...');

    // 6.1 Cohort of historical customers spread May - Oct 2026
    const historicalCustomers = [
      { name: 'Kavita Das', email: 'kavita.das@demo.local', phone: '+91 98451 22331', address: '12, 4th Main, HAL 2nd Stage, Indiranagar', lat: 12.9752, lng: 77.6385, created_at: '2026-05-12T10:15:00Z' },
      { name: 'Rohan Sen', email: 'rohan.sen@demo.local', phone: '+91 98452 33442', address: '45, 100ft Road, Indiranagar', lat: 12.9781, lng: 77.6412, created_at: '2026-05-24T14:30:00Z' },
      { name: 'Sneha Pillai', email: 'sneha.pillai@demo.local', phone: '+91 98453 44553', address: '78, CMH Road, Indiranagar', lat: 12.9795, lng: 77.6378, created_at: '2026-06-08T09:45:00Z' },
      { name: 'Vikram Malhotra', email: 'vikram.malhotra@demo.local', phone: '+91 98454 55664', address: '18, Old Airport Road, Domlur', lat: 12.9620, lng: 77.6450, created_at: '2026-06-22T17:20:00Z' },
      { name: 'Arvind Swamy', email: 'arvind.swamy@demo.local', phone: '+91 98455 66775', address: '9, Cambridge Road, Ulsoor', lat: 12.9725, lng: 77.6290, created_at: '2026-07-05T11:10:00Z' },
      { name: 'Divya Iyer', email: 'divya.iyer@demo.local', phone: '+91 98456 77886', address: '34, 12th Main, Indiranagar', lat: 12.9738, lng: 77.6362, created_at: '2026-07-19T18:40:00Z' },
      { name: 'Nikhil Reddy', email: 'nikhil.reddy@demo.local', phone: '+91 98457 88997', address: '88, Defence Colony, Indiranagar', lat: 12.9812, lng: 77.6448, created_at: '2026-08-04T12:05:00Z' },
      { name: 'Meera Nambiar', email: 'meera.nambiar@demo.local', phone: '+91 98458 99008', address: '6, Murphy Town, Ulsoor', lat: 12.9820, lng: 77.6250, created_at: '2026-08-21T16:50:00Z' },
      { name: 'Sanjay Kulkarni', email: 'sanjay.kulkarni@demo.local', phone: '+91 98459 10119', address: '55, 6th Cross, Indiranagar', lat: 12.9765, lng: 77.6395, created_at: '2026-09-02T10:30:00Z' },
      { name: 'Varun Hegde', email: 'varun.hegde@demo.local', phone: '+91 98450 21220', address: '101, HAL 3rd Stage, Indiranagar', lat: 12.9690, lng: 77.6520, created_at: '2026-09-15T15:15:00Z' },
      { name: 'Pooja Joshi', email: 'pooja.joshi@demo.local', phone: '+91 98451 32331', address: '22, Thippasandra Main Road', lat: 12.9730, lng: 77.6560, created_at: '2026-09-28T18:10:00Z' },
      { name: 'Ritu Varma', email: 'ritu.varma@demo.local', phone: '+91 98452 43442', address: '7, 1st Stage, Domlur Layout', lat: 12.9645, lng: 77.6380, created_at: '2026-10-04T11:45:00Z' },
      { name: 'Harish Chander', email: 'harish.chander@demo.local', phone: '+91 98453 54553', address: '14, Kodihalli Main Road, HAL', lat: 12.9660, lng: 77.6480, created_at: '2026-10-10T17:35:00Z' },
    ];

    const customerIds = [];
    for (const c of historicalCustomers) {
      const cRes = await client.query(
        `INSERT INTO customers (name, email, password_hash, phone, address, latitude, longitude, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         ON CONFLICT (email) DO UPDATE SET created_at = EXCLUDED.created_at
         RETURNING id`,
        [c.name, c.email, customerPasswordHash, c.phone, c.address, c.lat, c.lng, c.created_at]
      );
      customerIds.push(cRes.rows[0].id);
    }

    // 6.2 Cohort of historical partners spread May - Oct 2026
    const historicalPartners = [
      { name: 'Kiran Patel', email: 'kiran.ac@fixitnow.local', phone: '+91 97410 11223', address: '12, CMH Road, Indiranagar', service_slug: 'ac-repair', online: true, lat: 12.976, lng: 77.638, kyc: 'verified', rating: 4.95, jobs: 156, badge: 'HVAC Certified Specialist', created_at: '2026-05-02T08:00:00Z', plan: 'yearly' },
      { name: 'Amit Verma', email: 'amit.electric@fixitnow.local', phone: '+91 98220 44332', address: '44, 100ft Road, Indiranagar', service_slug: 'electrician', online: true, lat: 12.978, lng: 77.642, kyc: 'verified', rating: 4.88, jobs: 94, badge: 'Industrial Wiring Expert', created_at: '2026-06-12T14:00:00Z', plan: 'half-yearly' },
      { name: 'Gopal Verma', email: 'gopal.carpenter@fixitnow.local', phone: '+91 94490 55667', address: '16, Old Airport Road, Domlur', service_slug: 'carpenter', online: true, lat: 12.963, lng: 77.646, kyc: 'verified', rating: 4.84, jobs: 78, badge: 'Senior Furniture Joiner', created_at: '2026-07-18T10:45:00Z', plan: 'quarterly' },
      { name: 'Priya Sundaram', email: 'priya.appliance@fixitnow.local', phone: '+91 98330 66778', address: '8, Murphy Town, Ulsoor', service_slug: 'appliance-repair', online: true, lat: 12.9815, lng: 77.626, kyc: 'verified', rating: 4.86, jobs: 82, badge: 'Appliance Specialist', created_at: '2026-08-01T12:00:00Z', plan: 'half-yearly' },
      { name: 'Farhan Akhtar', email: 'farhan.ac@fixitnow.local', phone: '+91 97412 88291', address: '30, 100ft Road, Indiranagar', service_slug: 'ac-repair', online: false, lat: 12.9770, lng: 77.6410, kyc: 'verified', rating: 4.79, jobs: 54, badge: 'Split AC Specialist', created_at: '2026-09-05T09:00:00Z', plan: 'quarterly' },
    ];

    const partnerIdMap = {};
    for (const hp of historicalPartners) {
      const servId = serviceMap[hp.service_slug] || Object.values(serviceMap)[0];
      const pRes = await client.query(
        `INSERT INTO partners (
           name, email, password_hash, phone, address,
           service_id, online, latitude, longitude,
           kyc_status, rating, total_jobs, badge, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
         ON CONFLICT (email) DO UPDATE SET
           rating = EXCLUDED.rating,
           total_jobs = EXCLUDED.total_jobs,
           created_at = EXCLUDED.created_at
         RETURNING id`,
        [hp.name, hp.email, partnerPasswordHash, hp.phone, hp.address, servId, hp.online, hp.lat, hp.lng, hp.kyc, hp.rating, hp.jobs, hp.badge, hp.created_at]
      );
      partnerIdMap[hp.email] = pRes.rows[0].id;

      // Seed monthly subscriptions for revenue chart across all 6 months
      const pPlanId = planMap[hp.plan] || Object.values(planMap)[0];
      const pPlanPrice = hp.plan === 'yearly' ? 2799 : hp.plan === 'half-yearly' ? 1599 : 899;
      await client.query(
        `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status, created_at)
         VALUES ($1, $2, $3, $4::timestamptz, $4::timestamptz + INTERVAL '180 days', 'active', $4::timestamptz)
         ON CONFLICT DO NOTHING`,
        [pRes.rows[0].id, pPlanId, pPlanPrice, hp.created_at]
      );
    }

    // 6.3 Additional monthly subscriptions to ensure rich revenue data in every single month
    const extraMonthlySubs = [
      { month: '2026-05-10T10:00:00Z', price: 2799.00 },
      { month: '2026-05-22T14:00:00Z', price: 1599.00 },
      { month: '2026-06-05T09:30:00Z', price: 2799.00 },
      { month: '2026-06-18T16:00:00Z', price: 1599.00 },
      { month: '2026-06-27T11:00:00Z', price: 899.00 },
      { month: '2026-07-04T10:15:00Z', price: 2799.00 },
      { month: '2026-07-16T15:00:00Z', price: 1599.00 },
      { month: '2026-07-28T18:00:00Z', price: 1599.00 },
      { month: '2026-08-08T12:00:00Z', price: 2799.00 },
      { month: '2026-08-19T14:30:00Z', price: 2799.00 },
      { month: '2026-08-29T17:00:00Z', price: 899.00 },
      { month: '2026-09-03T09:00:00Z', price: 2799.00 },
      { month: '2026-09-14T11:30:00Z', price: 1599.00 },
      { month: '2026-09-25T16:45:00Z', price: 2799.00 },
      { month: '2026-10-02T10:00:00Z', price: 2799.00 },
      { month: '2026-10-08T14:00:00Z', price: 1599.00 },
      { month: '2026-10-12T17:30:00Z', price: 899.00 },
    ];

    const allPartnersRes = await client.query('SELECT id FROM partners');
    const allPartnerIds = allPartnersRes.rows.map((r) => r.id);
    for (let i = 0; i < extraMonthlySubs.length; i++) {
      const sub = extraMonthlySubs[i];
      const partnerId = allPartnerIds[i % allPartnerIds.length];
      const planId = sub.price === 2799 ? planMap['yearly'] : sub.price === 1599 ? planMap['half-yearly'] : planMap['quarterly'];
      await client.query(
        `INSERT INTO subscriptions (partner_id, plan_id, price_paid, start_date, end_date, status, created_at)
         VALUES ($1, $2, $3, $4::timestamptz, $4::timestamptz + INTERVAL '180 days', 'active', $4::timestamptz)`,
        [partnerId, planId, sub.price, sub.month]
      );
    }

    // 6.4 Clean up previous historical seed requests to prevent accumulation on re-seeds
    await client.query("DELETE FROM requests WHERE description LIKE '%[Historical Seed]%'");

    // 6.5 Generate ~135 historical requests spanning May to October 2026
    const serviceProblems = {
      plumber: [
        'Under-sink kitchen drain pipe leaking profusely',
        'Overhead water tank ball valve jammed',
        'Flush valve tank overflowing continuously',
        'Bathroom washbasin tap dripping constantly',
        'Shower mixer cartridge jammed and stiff',
      ],
      electrician: [
        'Main circuit breaker tripping intermittently under load',
        'Short circuit in master bedroom switchboard',
        'Ceiling fan regulator sparking and overheating',
        'Exhaust fan motor jammed in kitchen',
        'Power socket burnt out behind refrigerator',
      ],
      'ac-repair': [
        'Split AC not blowing cold air, outdoor fan silent',
        'Water leaking from indoor AC blower unit onto sofa',
        'AC compressor making loud humming and rattling sound',
        'Filter cleaning and seasonal refrigerant top-up',
        'AC turning off automatically after 10 minutes run',
      ],
      carpenter: [
        'Front main door wooden lock deadbolt jammed',
        'Wardrobe double hinge loose and sagging against frame',
        'Kitchen drawer sliding track stuck and derailed',
        'Teak wood dining chair leg loose and creaking',
        'Balcony mosquito mesh door frame misaligned',
      ],
      'appliance-repair': [
        'Front-load washing machine drum not spinning during drain',
        'Microwave glass turntable plate not heating food',
        'Double door refrigerator frost buildup and warm cooling',
        'Electric chimney suction motor vibrating loudly',
        'Water purifier UV lamp alert beeping continuously',
      ],
    };

    const reviewComments = [
      'Prompt arrival and excellent workmanship! Cleaned up the area after finishing.',
      'Very skilled technician. Fixed the issue in under 20 minutes with genuine spares.',
      'Professional, courteous and clearly explained the fix. Highly recommended.',
      'Arrived right on time and had all required tools ready in his kit.',
      'Superb work! Solved the issue that two previous handymen failed to address.',
      'Quick response and neat finish. Very satisfied with the service quality.',
    ];

    const monthsConfig = [
      { month: 5, year: 2026, count: 18 },
      { month: 6, year: 2026, count: 24 },
      { month: 7, year: 2026, count: 28 },
      { month: 8, year: 2026, count: 32 },
      { month: 9, year: 2026, count: 36 },
      { month: 10, year: 2026, count: 26 },
    ];

    const serviceSlugs = ['plumber', 'electrician', 'ac-repair', 'carpenter', 'appliance-repair'];
    // Weighted selection for services: plumber (35%), electrician (25%), ac-repair (18%), carpenter (12%), appliance-repair (10%)
    const serviceWeights = ['plumber', 'plumber', 'plumber', 'electrician', 'electrician', 'ac-repair', 'ac-repair', 'carpenter', 'appliance-repair'];

    // Peak hours distribution: morning rush (10-12) & evening surge (17-19)
    const peakHourPool = [
      7, 8, 8, 9, 9, 9,
      10, 10, 10, 11, 11, 11, 11, 12, 12, 12,
      13, 13, 14, 15, 15, 16, 16,
      17, 17, 17, 18, 18, 18, 18, 19, 19, 19,
      20, 20, 21, 21
    ];

    let totalHistoricalCreated = 0;

    for (const mConf of monthsConfig) {
      for (let i = 0; i < mConf.count; i++) {
        const servSlug = serviceWeights[i % serviceWeights.length];
        const servId = serviceMap[servSlug] || Object.values(serviceMap)[0];
        const problems = serviceProblems[servSlug] || serviceProblems.plumber;
        const problem = problems[i % problems.length];
        const custId = customerIds[i % customerIds.length];
        const partId = allPartnerIds[i % allPartnerIds.length];

        // Pick date and peak hour
        const day = 1 + (i % 27);
        const hour = peakHourPool[(i * 3 + mConf.month) % peakHourPool.length];
        const minute = (i * 7) % 60;
        const dateStr = `${mConf.year}-${String(mConf.month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`;

        // 88% completed, 8% customer cancelled, 4% busy timeout
        let status = 'payment_completed';
        let cancelReason = null;
        if (i % 12 === 11) {
          status = 'cancelled';
          cancelReason = 'All partners busy, try again later';
        } else if (i % 12 === 10) {
          status = 'cancelled';
          cancelReason = 'Customer had an emergency reschedule';
        }

        const reqRes = await client.query(
          `INSERT INTO requests (
             customer_id, partner_id, service_id, problem, description,
             address, latitude, longitude, status, cancel_reason,
             service_otp, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $12::timestamptz + INTERVAL '45 minutes')
           RETURNING id`,
          [
            custId,
            status === 'payment_completed' ? partId : (cancelReason?.includes('busy') ? null : partId),
            servId,
            problem,
            `Verified customer reported: ${problem}. [Historical Seed]`,
            'Indiranagar 100ft Road, Bengaluru',
            12.9784,
            77.6408,
            status,
            cancelReason,
            '482910',
            dateStr,
          ]
        );

        const newReqId = reqRes.rows[0].id;
        totalHistoricalCreated++;

        // Add payment & rating for completed jobs
        if (status === 'payment_completed') {
          const recNo = `REC-${String(mConf.year).slice(2)}${String(mConf.month).padStart(2, '0')}-${String(1000 + (totalHistoricalCreated % 9000))}`;
          await client.query(
            `INSERT INTO payments (request_id, amount, status, receipt_no, created_at)
             VALUES ($1, 400.00, 'successful', $2, $3::timestamptz + INTERVAL '40 minutes')
             ON CONFLICT DO NOTHING`,
            [newReqId, recNo, dateStr]
          );

          const stars = (i % 5 === 0) ? 4 : 5;
          const comment = reviewComments[(i + mConf.month) % reviewComments.length];
          await client.query(
            `INSERT INTO ratings (request_id, partner_id, stars, comment, created_at)
             VALUES ($1, $2, $3, $4, $5::timestamptz + INTERVAL '45 minutes')`,
            [newReqId, partId, stars, comment, dateStr]
          );
        }
      }
    }

    // 6.6 Seed 1 live active job in progress right now for the Live Users Monitor
    const activePartnerRes = await client.query("SELECT id, name FROM partners WHERE online = true LIMIT 1");
    if (activePartnerRes.rows.length > 0 && customerIds.length > 0) {
      const livePart = activePartnerRes.rows[0];
      await client.query(
        `INSERT INTO requests (
           customer_id, partner_id, service_id, problem, description,
           address, latitude, longitude, status, service_otp, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'service_started', '582914', CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          customerIds[0],
          livePart.id,
          Object.values(serviceMap)[0],
          'Under-sink pipe dripping onto cabinet floor',
          'Active ongoing job for live field dispatch monitor. [Historical Seed]',
          '54, 12th Main Road, Indiranagar, Bengaluru',
          12.9740,
          77.6350,
        ]
      );
    }

    console.log(`✓ Seeded ${totalHistoricalCreated} historical requests across May - Oct 2026 with ratings and payments.`);

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
