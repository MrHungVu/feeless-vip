import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function initDb() {
  try {
    const schemaPath = join(__dirname, 'schema.sql');
    console.log('Loading schema from:', schemaPath);
    const schema = readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Ensure critical tables exist (called separately for resilience)
export async function ensureRateLimitTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        identifier VARCHAR(100) NOT NULL,
        request_count INT DEFAULT 0,
        window_start TIMESTAMP DEFAULT NOW(),
        UNIQUE(identifier)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_rate_identifier ON rate_limits(identifier)`);
  } catch (error) {
    console.error('Failed to ensure rate_limits table:', error);
  }
}
