import { pool, initDb } from './init.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  try {
    await initDb();
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
