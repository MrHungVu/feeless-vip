---
parent: ./plan.md
phase: 6
status: pending
effort: 2h
depends_on: [phase-02]
---

# Phase 6: Admin Dashboard

## Overview

Simple admin page to view flagged users and abuse incidents. Protected by API key.

## Dependencies

- Phase 2: Abuse tracking tables

## New Files

### `backend/src/routes/admin.ts`

```typescript
import { Router } from 'express';
import { getFlaggedUsers, getIncidents, setUserFlag, setBlacklist, getUserStats } from '../services/abuse-tracker.js';

export const adminRoutes = Router();

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

// Simple API key auth middleware
function adminAuth(req: any, res: any, next: any) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

adminRoutes.use(adminAuth);

// Get flagged users
adminRoutes.get('/flagged', async (req, res, next) => {
  try {
    const users = await getFlaggedUsers();
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
      return res.status(404).json({ error: 'User not found' });
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
      wallet as string,
      ip as string,
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
```

### `frontend/src/pages/Admin.tsx`

```typescript
import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UserStats {
  wallet_address: string;
  ip_addresses: string[];
  total_requests: number;
  completed_count: number;
  abandoned_count: number;
  flagged: boolean;
  flag_reason: string | null;
  blacklisted: boolean;
}

interface Incident {
  id: string;
  wallet_address: string;
  ip_address: string;
  incident_type: string;
  created_at: string;
}

export function Admin() {
  const [apiKey, setApiKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [flaggedUsers, setFlaggedUsers] = useState<UserStats[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { 'x-admin-key': apiKey };

      const [usersRes, incidentsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/flagged`, { headers }),
        fetch(`${API_URL}/api/admin/incidents?limit=20`, { headers })
      ]);

      if (!usersRes.ok || !incidentsRes.ok) {
        throw new Error('Unauthorized');
      }

      const users = await usersRes.json();
      const incs = await incidentsRes.json();

      setFlaggedUsers(users.users);
      setIncidents(incs.incidents);
      setAuthenticated(true);
    } catch (e) {
      setError('Failed to fetch data. Check API key.');
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (wallet: string, action: 'unflag' | 'blacklist') => {
    try {
      await fetch(`${API_URL}/api/admin/users/${wallet}/${action}`, {
        method: 'POST',
        headers: { 'x-admin-key': apiKey }
      });
      fetchData();
    } catch {
      setError('Action failed');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-6 rounded-lg space-y-4 w-80">
          <h1 className="text-xl font-bold">Admin Login</h1>
          <input
            type="password"
            placeholder="API Key"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full py-2 bg-blue-600 rounded"
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button
            onClick={() => setAuthenticated(false)}
            className="text-red-400 hover:underline"
          >
            Logout
          </button>
        </div>

        {/* Flagged Users */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">
            Flagged Users ({flaggedUsers.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left p-2">Wallet</th>
                  <th className="text-left p-2">Requests</th>
                  <th className="text-left p-2">Completed</th>
                  <th className="text-left p-2">Abandoned</th>
                  <th className="text-left p-2">IPs</th>
                  <th className="text-left p-2">Reason</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedUsers.map(user => (
                  <tr key={user.wallet_address} className="border-b border-gray-700">
                    <td className="p-2 font-mono text-xs">
                      {user.wallet_address.slice(0, 12)}...
                    </td>
                    <td className="p-2">{user.total_requests}</td>
                    <td className="p-2 text-green-400">{user.completed_count}</td>
                    <td className="p-2 text-red-400">{user.abandoned_count}</td>
                    <td className="p-2">{user.ip_addresses.length}</td>
                    <td className="p-2 text-xs">{user.flag_reason}</td>
                    <td className="p-2 space-x-2">
                      <button
                        onClick={() => handleAction(user.wallet_address, 'unflag')}
                        className="text-blue-400 hover:underline"
                      >
                        Unflag
                      </button>
                      <button
                        onClick={() => handleAction(user.wallet_address, 'blacklist')}
                        className="text-red-400 hover:underline"
                      >
                        Blacklist
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Recent Incidents</h2>
          <div className="space-y-2">
            {incidents.map(inc => (
              <div
                key={inc.id}
                className="flex justify-between text-sm p-2 bg-gray-700/50 rounded"
              >
                <span className="font-mono text-xs">
                  {inc.wallet_address.slice(0, 12)}...
                </span>
                <span className="text-gray-400">{inc.ip_address}</span>
                <span className={
                  inc.incident_type === 'abandoned' ? 'text-red-400' : 'text-yellow-400'
                }>
                  {inc.incident_type}
                </span>
                <span className="text-gray-500">
                  {new Date(inc.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Modified Files

### `backend/src/index.ts`

Add admin routes:
```typescript
import { adminRoutes } from './routes/admin.js';

// After other routes
app.use('/api/admin', adminRoutes);
```

### `frontend/src/App.tsx`

Add admin route:
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Admin } from './pages/Admin';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### `.env.example`

Add:
```bash
ADMIN_API_KEY=your-secret-admin-key
```

## Implementation Steps

- [ ] Create `backend/src/routes/admin.ts`
- [ ] Add admin routes to index.ts
- [ ] Create `frontend/src/pages/Admin.tsx`
- [ ] Add react-router-dom if not present
- [ ] Update App.tsx with routes
- [ ] Add ADMIN_API_KEY to .env
- [ ] Test admin authentication
- [ ] Test flag/unflag/blacklist actions

## Success Criteria

- [ ] Admin page requires API key
- [ ] Flagged users displayed in table
- [ ] Recent incidents displayed
- [ ] Can unflag users
- [ ] Can blacklist users
- [ ] UI updates after actions
