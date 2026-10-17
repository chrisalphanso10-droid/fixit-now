/**
 * FixIt Now - Scratch Script: Test Admin Analytics Queries
 */
import { query } from '../server/src/config/db.js';

async function run() {
  console.log('--- Testing Admin Analytics Queries ---');
  
  // 1. KPI summary
  const summaryRes = await query(`
    SELECT 
      COUNT(*)::int AS total_requests,
      COUNT(*) FILTER (WHERE status IN ('service_completed', 'payment_completed'))::int AS completed_requests,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_requests,
      COUNT(*) FILTER (WHERE status = 'cancelled' AND cancel_reason ILIKE '%busy%')::int AS unassigned_timeouts
    FROM requests;
  `);
  console.log('Summary:', summaryRes.rows[0]);

  // 2. Requests over time
  const rotRes = await query(`
    SELECT 
      TO_CHAR(created_at, 'Mon YYYY') AS period,
      DATE_TRUNC('month', created_at) AS sort_month,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status IN ('service_completed', 'payment_completed'))::int AS completed,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
    FROM requests
    GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(created_at, 'Mon YYYY')
    ORDER BY sort_month ASC;
  `);
  console.log('Requests Over Time:', rotRes.rows);

  // 3. Top services
  const topServicesRes = await query(`
    SELECT 
      s.name AS name,
      COUNT(r.id)::int AS requests
    FROM services s
    LEFT JOIN requests r ON r.service_id = s.id
    GROUP BY s.id, s.name
    ORDER BY requests DESC;
  `);
  console.log('Top Services:', topServicesRes.rows);

  // 4. Partner and Customer Growth (Past 6 months)
  const growthRes = await query(`
    WITH months AS (
      SELECT DATE_TRUNC('month', d)::date AS m
      FROM GENERATE_SERIES(
        '2026-05-01'::date,
        '2026-10-01'::date,
        INTERVAL '1 month'
      ) d
    )
    SELECT 
      TO_CHAR(m.m, 'Mon') AS month,
      m.m AS sort_month,
      (SELECT COUNT(*)::int FROM customers c WHERE c.created_at <= (m.m + INTERVAL '1 month - 1 millisecond')) AS customers,
      (SELECT COUNT(*)::int FROM partners p WHERE p.created_at <= (m.m + INTERVAL '1 month - 1 millisecond')) AS partners
    FROM months m
    ORDER BY m.m ASC;
  `);
  console.log('Growth:', growthRes.rows);

  // 5. Subscription revenue
  const subRevRes = await query(`
    WITH months AS (
      SELECT DATE_TRUNC('month', d)::date AS m
      FROM GENERATE_SERIES(
        '2026-05-01'::date,
        '2026-10-01'::date,
        INTERVAL '1 month'
      ) d
    )
    SELECT 
      TO_CHAR(m.m, 'Mon') AS month,
      m.m AS sort_month,
      COALESCE(SUM(s.price_paid), 0)::float AS revenue,
      COUNT(s.id)::int AS new_subscriptions
    FROM months m
    LEFT JOIN subscriptions s ON DATE_TRUNC('month', s.created_at) = m.m
    GROUP BY m.m
    ORDER BY m.m ASC;
  `);
  console.log('Subscription Revenue:', subRevRes.rows);

  // 6. Peak hours
  const peakRes = await query(`
    WITH hours AS (
      SELECT h AS hour_num FROM GENERATE_SERIES(7, 21) h
    )
    SELECT 
      LPAD(h.hour_num::text, 2, '0') || ':00' AS hour,
      COUNT(r.id)::int AS requests
    FROM hours h
    LEFT JOIN requests r ON EXTRACT(HOUR FROM r.created_at AT TIME ZONE 'Asia/Kolkata') = h.hour_num
    GROUP BY h.hour_num
    ORDER BY h.hour_num ASC;
  `);
  console.log('Peak Hours (sample 10):', peakRes.rows.slice(0, 10));

  // 7. Top-rated partners
  const topPartnersRes = await query(`
    SELECT 
      p.id,
      p.name,
      s.name AS service,
      COALESCE(ROUND(AVG(rt.stars), 2), p.rating, 5.0)::float AS rating,
      GREATEST(COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('service_completed', 'payment_completed')), p.total_jobs)::int AS jobs
    FROM partners p
    JOIN services s ON p.service_id = s.id
    LEFT JOIN ratings rt ON rt.partner_id = p.id
    LEFT JOIN requests r ON r.partner_id = p.id
    GROUP BY p.id, p.name, s.name, p.rating, p.total_jobs
    ORDER BY rating DESC, jobs DESC
    LIMIT 6;
  `);
  console.log('Top Rated Partners:', topPartnersRes.rows);

  // 8. Live online partners
  const liveOnlineRes = await query(`
    SELECT 
      p.id,
      p.name,
      s.name AS service,
      CASE 
        WHEN r.id IS NOT NULL THEN 'on_job'
        ELSE 'available'
      END AS status,
      COALESCE(
        'ORD-' || UPPER(SUBSTRING(REPLACE(r.id::text, '-', ''), 1, 4)),
        'AVAILABLE'
      ) AS order_number
    FROM partners p
    JOIN services s ON p.service_id = s.id
    LEFT JOIN requests r ON r.partner_id = p.id 
      AND r.status IN ('accepted', 'partner_on_way', 'partner_arrived', 'service_started')
    WHERE p.online = true
    ORDER BY p.name ASC
    LIMIT 8;
  `);
  console.log('Live Online Partners:', liveOnlineRes.rows);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
