import { pool } from '../server/src/config/db.js';

async function checkUser() {
  const res = await pool.query("SELECT * FROM users WHERE email = $1", ['mohit@gmail.com']);
  console.log('User found in users table:', res.rows);
  if (res.rows.length > 0) {
    const user = res.rows[0];
    if (user.role === 'customer') {
      const cust = await pool.query("SELECT * FROM customers WHERE user_id = $1", [user.id]);
      console.log('Customer row:', cust.rows);
      const reqs = await pool.query("SELECT * FROM requests WHERE customer_id = $1", [cust.rows[0]?.id]);
      console.log('Requests for customer:', reqs.rows);
    } else if (user.role === 'partner') {
      const part = await pool.query("SELECT * FROM partners WHERE user_id = $1", [user.id]);
      console.log('Partner row:', part.rows);
      const reqs = await pool.query("SELECT * FROM requests WHERE partner_id = $1", [part.rows[0]?.id]);
      console.log('Requests for partner:', reqs.rows);
    }
  }
  await pool.end();
}

checkUser().catch(console.error);
