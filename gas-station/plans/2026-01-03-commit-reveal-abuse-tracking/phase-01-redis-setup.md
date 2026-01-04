---
parent: ./plan.md
phase: 1
status: pending
effort: 2h
---

# Phase 1: Redis Setup + Pending Transaction Storage

## Overview

Set up Redis for storing pending signed transactions with 5-minute TTL. This enables the commit-reveal pattern where we hold user's signed transaction before delegating energy.

## Dependencies

- None (first phase)

## Requirements

1. Redis connection with reconnect logic
2. Pending transaction storage with TTL
3. Helpers for get/set/delete operations
4. Expiration tracking for abandonment detection

## New Files

### `backend/src/services/redis.ts`

```typescript
import Redis from 'ioredis';

const PENDING_TX_TTL = 300; // 5 minutes

interface PendingTransaction {
  signedTx: any;
  quoteId: string;
  userAddress: string;
  ipAddress: string;
  usdtAmount: string;
  trxAmount: string;
  createdAt: number;
}

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100
    });
    redis.on('error', (err) => console.error('Redis error:', err));
  }
  return redis;
}

export async function storePendingTx(
  commitId: string,
  data: PendingTransaction
): Promise<void> {
  await getRedis().setex(
    `pending:tx:${commitId}`,
    PENDING_TX_TTL,
    JSON.stringify(data)
  );
}

export async function getPendingTx(
  commitId: string
): Promise<PendingTransaction | null> {
  const data = await getRedis().get(`pending:tx:${commitId}`);
  return data ? JSON.parse(data) : null;
}

export async function deletePendingTx(commitId: string): Promise<void> {
  await getRedis().del(`pending:tx:${commitId}`);
}

export async function listPendingTxIds(): Promise<string[]> {
  const keys = await getRedis().keys('pending:tx:*');
  return keys.map(k => k.replace('pending:tx:', ''));
}
```

## Modified Files

### `backend/package.json`

Add dependency:
```json
"ioredis": "^5.3.2"
```

### `.env.example`

Add:
```bash
REDIS_URL=redis://localhost:6379
```

## Implementation Steps

- [ ] Install ioredis: `npm install ioredis -w backend`
- [ ] Create `backend/src/services/redis.ts` with connection + helpers
- [ ] Add REDIS_URL to `.env.example` and `.env`
- [ ] Test connection: verify set/get/delete works
- [ ] Add TTL verification test

## Success Criteria

- [ ] Redis connects on server start
- [ ] Can store pending tx with 5-min TTL
- [ ] Can retrieve pending tx by commitId
- [ ] TTL auto-expires entries after 5 minutes
- [ ] Graceful handling of Redis connection errors
