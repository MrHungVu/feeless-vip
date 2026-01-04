import Redis from 'ioredis';

const PENDING_TX_TTL = 300; // 5 minutes

export interface PendingTransaction {
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
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true
    });
    redis.on('error', (err) => console.error('Redis error:', err));
    redis.on('connect', () => console.log('Redis connected'));
  }
  return redis;
}

export async function initRedis(): Promise<boolean> {
  try {
    const client = getRedis();
    await client.connect();
    await client.ping();
    return true;
  } catch (error) {
    console.warn('Redis init failed:', (error as Error).message);
    return false;
  }
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

export async function getTTL(commitId: string): Promise<number> {
  return await getRedis().ttl(`pending:tx:${commitId}`);
}
