/**
 * FixIt Now - Schema Migration Runner
 * Reads and applies db/schema.sql to PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });
dotenv.config();

const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://fixitnow:CCA142005@localhost:5432/fix_it_now';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function runMigration() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  console.log(`Reading schema from: ${schemaPath}`);
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  console.log('Connected to PostgreSQL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

  try {
    await client.query('BEGIN');
    console.log('Applying FixIt Now database schema...');
    await client.query(sql);

    // Apply migrations from db/migrations if present
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();

      for (const mFile of migrationFiles) {
        console.log(`Applying migration: ${mFile}`);
        const mSql = fs.readFileSync(path.join(migrationsDir, mFile), 'utf8');
        await client.query(mSql);
      }
    }

    await client.query('COMMIT');
    console.log('✓ FixIt Now schema and migrations applied successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Schema migration error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
