import { Router } from 'express';
import { pool } from '../db/init.js';
import { connection } from '../services/solana/config.js';

export const healthRoutes = Router();

healthRoutes.get('/', async (_req, res) => {
  const checks: Record<string, boolean | string> = {
    database: false,
    solana_rpc: false,
    timestamp: new Date().toISOString()
  };

  try {
    await pool.query('SELECT 1');
    checks.database = true;
  } catch {
    // Database not available
  }

  try {
    await connection.getSlot();
    checks.solana_rpc = true;
  } catch {
    // Solana RPC not available
  }

  const healthy = checks.database && checks.solana_rpc;
  res.status(healthy ? 200 : 503).json(checks);
});
