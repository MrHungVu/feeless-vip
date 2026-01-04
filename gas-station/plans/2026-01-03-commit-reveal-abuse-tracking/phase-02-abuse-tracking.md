---
parent: ./plan.md
phase: 2
status: pending
effort: 3h
depends_on: []
---

# Phase 2: Abuse Tracking System

## Overview

Implement abuse tracking to detect farming patterns. Track user behavior (requests, completions, abandonments) and flag suspicious activity for manual review.

## Dependencies

- PostgreSQL connection (already exists)

## Database Schema

Add to `backend/src/db/schema.sql`:

```sql
-- User behavior tracking
CREATE TABLE IF NOT EXISTS user_stats (
  wallet_address VARCHAR(50) PRIMARY KEY,
  ip_addresses TEXT[] DEFAULT '{}',
  total_requests INT DEFAULT 0,
  completed_count INT DEFAULT 0,
  abandoned_count INT DEFAULT 0,
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  blacklisted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual incidents for auditing
CREATE TABLE IF NOT EXISTS abuse_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(50) NOT NULL,
  ip_address VARCHAR(50) NOT NULL,
  incident_type VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_abuse_wallet ON abuse_incidents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_abuse_ip ON abuse_incidents(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_flagged ON user_stats(flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_blacklisted ON user_stats(blacklisted) WHERE blacklisted = TRUE;
```

## New Files

### `backend/src/services/abuse-tracker.ts`

```typescript
import { pool } from '../db/init.js';

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

// Flag thresholds
const ABANDON_THRESHOLD_WALLET = 3;
const ABANDON_THRESHOLD_IP = 5;
const MULTI_IP_THRESHOLD = 3;
const MULTI_WALLET_THRESHOLD = 5;

export async function trackRequest(wallet: string, ip: string): Promise<void> {
  await pool.query(`
    INSERT INTO user_stats (wallet_address, ip_addresses, total_requests, last_seen_at)
    VALUES ($1, ARRAY[$2], 1, NOW())
    ON CONFLICT (wallet_address) DO UPDATE SET
      ip_addresses = CASE
        WHEN NOT ($2 = ANY(user_stats.ip_addresses))
        THEN array_append(user_stats.ip_addresses, $2)
        ELSE user_stats.ip_addresses
      END,
      total_requests = user_stats.total_requests + 1,
      last_seen_at = NOW()
  `, [wallet, ip]);
}

export async function trackCompletion(wallet: string): Promise<void> {
  await pool.query(`
    UPDATE user_stats SET completed_count = completed_count + 1
    WHERE wallet_address = $1
  `, [wallet]);
}

export async function trackAbandonment(wallet: string, ip: string): Promise<void> {
  // Update stats
  await pool.query(`
    UPDATE user_stats SET abandoned_count = abandoned_count + 1
    WHERE wallet_address = $1
  `, [wallet]);

  // Log incident
  await pool.query(`
    INSERT INTO abuse_incidents (wallet_address, ip_address, incident_type, details)
    VALUES ($1, $2, 'abandoned', '{}')
  `, [wallet, ip]);

  // Check flag triggers
  await checkFlagTriggers(wallet, ip);
}

export async function checkFlagTriggers(wallet: string, ip: string): Promise<void> {
  const stats = await getUserStats(wallet);
  if (!stats) return;

  let shouldFlag = false;
  let reason = '';

  // Check wallet abandonment threshold
  if (stats.abandoned_count >= ABANDON_THRESHOLD_WALLET) {
    shouldFlag = true;
    reason = `${stats.abandoned_count}+ abandonments from wallet`;
  }

  // Check multi-IP usage
  if (stats.ip_addresses.length >= MULTI_IP_THRESHOLD) {
    shouldFlag = true;
    reason = `Wallet used from ${stats.ip_addresses.length}+ IPs`;
  }

  // Check IP abandonment count
  const ipAbandons = await pool.query(`
    SELECT COUNT(*) FROM abuse_incidents
    WHERE ip_address = $1 AND incident_type = 'abandoned'
  `, [ip]);
  if (parseInt(ipAbandons.rows[0].count) >= ABANDON_THRESHOLD_IP) {
    shouldFlag = true;
    reason = `${ABANDON_THRESHOLD_IP}+ abandonments from IP`;
  }

  // Check wallets per IP
  const walletsPerIp = await pool.query(`
    SELECT COUNT(*) FROM user_stats WHERE $1 = ANY(ip_addresses)
  `, [ip]);
  if (parseInt(walletsPerIp.rows[0].count) >= MULTI_WALLET_THRESHOLD) {
    shouldFlag = true;
    reason = `${MULTI_WALLET_THRESHOLD}+ wallets from same IP`;
  }

  if (shouldFlag && !stats.flagged) {
    await setUserFlag(wallet, true, reason);
  }
}

export async function getUserStats(wallet: string): Promise<UserStats | null> {
  const result = await pool.query(
    'SELECT * FROM user_stats WHERE wallet_address = $1',
    [wallet]
  );
  return result.rows[0] || null;
}

export async function isBlacklisted(wallet: string, ip: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT 1 FROM user_stats
    WHERE (wallet_address = $1 OR $2 = ANY(ip_addresses))
    AND blacklisted = TRUE
    LIMIT 1
  `, [wallet, ip]);
  return result.rows.length > 0;
}

export async function isFlagged(wallet: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT flagged FROM user_stats WHERE wallet_address = $1',
    [wallet]
  );
  return result.rows[0]?.flagged || false;
}

export async function setUserFlag(
  wallet: string,
  flagged: boolean,
  reason?: string
): Promise<void> {
  await pool.query(`
    UPDATE user_stats SET flagged = $2, flag_reason = $3
    WHERE wallet_address = $1
  `, [wallet, flagged, reason || null]);
}

export async function setBlacklist(wallet: string, blacklisted: boolean): Promise<void> {
  await pool.query(
    'UPDATE user_stats SET blacklisted = $1 WHERE wallet_address = $2',
    [blacklisted, wallet]
  );
}

export async function getFlaggedUsers(): Promise<UserStats[]> {
  const result = await pool.query(
    'SELECT * FROM user_stats WHERE flagged = TRUE ORDER BY abandoned_count DESC'
  );
  return result.rows;
}

export async function getIncidents(
  wallet?: string,
  ip?: string,
  limit = 50
): Promise<any[]> {
  let query = 'SELECT * FROM abuse_incidents WHERE 1=1';
  const params: any[] = [];

  if (wallet) {
    params.push(wallet);
    query += ` AND wallet_address = $${params.length}`;
  }
  if (ip) {
    params.push(ip);
    query += ` AND ip_address = $${params.length}`;
  }

  params.push(limit);
  query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await pool.query(query, params);
  return result.rows;
}
```

## Implementation Steps

- [ ] Add user_stats and abuse_incidents tables to schema.sql
- [ ] Run migration to create tables
- [ ] Create `backend/src/services/abuse-tracker.ts`
- [ ] Add trackRequest call to quote endpoint
- [ ] Add trackCompletion call to execute endpoint
- [ ] Add trackAbandonment call to expiry handler (Phase 3)
- [ ] Test flag triggers with mock data

## Success Criteria

- [ ] User stats tracked per wallet
- [ ] IP addresses accumulated per wallet
- [ ] Abandonments logged as incidents
- [ ] Flag triggers fire when thresholds exceeded
- [ ] Flagged users visible in admin query
- [ ] Blacklisted users blocked from service
