import { pool } from '../server/src/config/db.js';

async function checkTables() {
  const res = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log('Tables in DB:', res.rows.map(r => r.table_name));
  await pool.end();
}

checkTables().catch(console.error);
