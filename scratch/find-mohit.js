import { pool } from '../server/src/config/db.js';

async function findMohit() {
  const custRes = await pool.query("SELECT * FROM customers WHERE email = $1", ['mohit@gmail.com']);
  console.log('In customers:', custRes.rows);

  const partRes = await pool.query("SELECT * FROM partners WHERE email = $1", ['mohit@gmail.com']);
  console.log('In partners:', partRes.rows);

  const adminRes = await pool.query("SELECT * FROM admins WHERE email = $1", ['mohit@gmail.com']);
  console.log('In admins:', adminRes.rows);

  if (custRes.rows.length > 0) {
    const custId = custRes.rows[0].id;
    const reqs = await pool.query("SELECT * FROM requests WHERE customer_id = $1", [custId]);
    console.log('Customer requests:', reqs.rows);
    const addrs = await pool.query("SELECT * FROM saved_addresses WHERE customer_id = $1", [custId]);
    console.log('Customer saved addresses:', addrs.rows);
  }

  if (partRes.rows.length > 0) {
    const partId = partRes.rows[0].id;
    const reqs = await pool.query("SELECT * FROM requests WHERE partner_id = $1", [partId]);
    console.log('Partner requests:', reqs.rows);
  }

  await pool.end();
}

findMohit().catch(console.error);
