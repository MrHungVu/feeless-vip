import { Router, Request, Response, NextFunction } from 'express';
import {
  getFlaggedUsers,
  getBlacklistedUsers,
  getIncidents,
  setUserFlag,
  setBlacklist,
  getUserStats,
  getStats
} from '../services/abuse-tracker.js';

export const adminRoutes = Router();

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

// Simple API key auth middleware
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

adminRoutes.use(adminAuth);

// Get stats overview
adminRoutes.get('/stats', async (_req, res, next) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get flagged users
adminRoutes.get('/flagged', async (_req, res, next) => {
  try {
    const users = await getFlaggedUsers();
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// Get blacklisted users
adminRoutes.get('/blacklisted', async (_req, res, next) => {
  try {
    const users = await getBlacklistedUsers();
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// Get user stats
adminRoutes.get('/users/:wallet', async (req, res, next) => {
  try {
    const stats = await getUserStats(req.params.wallet);
    if (!stats) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get incidents
adminRoutes.get('/incidents', async (req, res, next) => {
  try {
    const { wallet, ip, limit } = req.query;
    const incidents = await getIncidents(
      wallet as string | undefined,
      ip as string | undefined,
      limit ? parseInt(limit as string) : 50
    );
    res.json({ incidents });
  } catch (error) {
    next(error);
  }
});

// Flag user
adminRoutes.post('/users/:wallet/flag', async (req, res, next) => {
  try {
    await setUserFlag(req.params.wallet, true, req.body.reason || 'Manual flag');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Unflag user
adminRoutes.post('/users/:wallet/unflag', async (req, res, next) => {
  try {
    await setUserFlag(req.params.wallet, false);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Blacklist user
adminRoutes.post('/users/:wallet/blacklist', async (req, res, next) => {
  try {
    await setBlacklist(req.params.wallet, true);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Unblacklist user
adminRoutes.post('/users/:wallet/unblacklist', async (req, res, next) => {
  try {
    await setBlacklist(req.params.wallet, false);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
