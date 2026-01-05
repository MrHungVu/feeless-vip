import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from project root (2 levels up from src/)
dotenv.config({ path: resolve(__dirname, '../../.env') });
// Also try monorepo root (3 levels up)
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import { solanaRoutes } from './routes/solana.js';
import { tronRoutes } from './routes/tron.js';
import { healthRoutes } from './routes/health.js';
import { adminRoutes } from './routes/admin.js';
import { errorHandler } from './middleware/error-handler.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { initDb } from './db/init.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(rateLimiter);

// Routes
app.use('/api/solana', solanaRoutes);
app.use('/api/tron', tronRoutes);
app.use('/api/admin', adminRoutes);
app.use('/health', healthRoutes);

// Error handler
app.use(errorHandler);

// Start
async function start() {
  try {
    await initDb();
  } catch (error) {
    console.error('DB init failed:', (error as Error).message);
  }

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}


start();
