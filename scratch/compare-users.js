import { pool } from '../server/src/config/db.js';

async function compareUsers() {
  const ananya = await pool.query("SELECT * FROM customers WHERE email = 'ananya@example.com'");
  console.log('Ananya customer row:', ananya.rows[0]);
  const ananyaReqs = await pool.query("SELECT * FROM requests WHERE customer_id = $1", [ananya.rows[0]?.id]);
  console.log('Ananya requests count:', ananyaReqs.rows.length);

  const mohit = await pool.query("SELECT * FROM customers WHERE email = 'mohit@gmail.com'");
  console.log('\nMohit customer row:', mohit.rows[0]);
  const mohitReqs = await pool.query("SELECT * FROM requests WHERE customer_id = $1", [mohit.rows[0]?.id]);
  console.log('Mohit requests:', mohitReqs.rows);

  await pool.end();
}

compareUsers().catch(console.error);
