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
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
  console.log('Database initialized');
}
