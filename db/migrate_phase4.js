import { pool } from '../server/src/config/db.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Running migration: update kyc_status constraint and kyc_documents columns...');
    
    // Drop existing check constraint on partners.kyc_status
    await client.query(`
      ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_kyc_status_check;
      ALTER TABLE partners ADD CONSTRAINT partners_kyc_status_check 
        CHECK (kyc_status IN ('not_submitted', 'pending', 'verified', 'rejected'));
      ALTER TABLE partners ALTER COLUMN kyc_status SET DEFAULT 'not_submitted';
    `);

    // Ensure kyc_documents has extra metadata columns
    await client.query(`
      ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
      ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
      ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_size INTEGER;
    `);

    await client.query('COMMIT');
    console.log('✓ Migration applied successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
