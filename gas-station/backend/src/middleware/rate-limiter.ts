import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/init.js';

const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_PER_MIN || '10');

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const identifier = req.ip || 'unknown';

  try {
    const result = await pool.query(
      `INSERT INTO rate_limits (identifier, request_count, window_start)
      VALUES ($1, 1, NOW())
      ON CONFLICT (identifier) DO UPDATE SET
        request_count = CASE
          WHEN rate_limits.window_start < NOW() - INTERVAL '1 minute' THEN 1
          ELSE rate_limits.request_count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < NOW() - INTERVAL '1 minute' THEN NOW()
          ELSE rate_limits.window_start
        END
      RETURNING request_count`,
      [identifier]
    );

    const count = result.rows[0].request_count;

    if (count > MAX_REQUESTS) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: 60
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next();
  }
}
