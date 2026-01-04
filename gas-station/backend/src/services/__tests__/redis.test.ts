import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock before importing
const mockRedisInstance = {
  setex: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  ttl: vi.fn().mockResolvedValue(300),
  ping: vi.fn().mockResolvedValue('PONG'),
  connect: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockReturnThis(),
};

// Mock ioredis with class constructor
vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      constructor() {
        return mockRedisInstance;
      }
    },
  };
});

// Reset singleton between tests
beforeEach(() => {
  vi.clearAllMocks();
  // Reset the redis singleton by reimporting
  vi.resetModules();
});

describe('Redis Service', () => {
  it('should store pending transaction with TTL', async () => {
    const { storePendingTx } = await import('../redis.js');

    const mockTx = {
      signedTx: { txID: 'test123' },
      quoteId: 'quote-123',
      userAddress: 'TTestAddress123',
      ipAddress: '127.0.0.1',
      usdtAmount: '10.00',
      trxAmount: '60.00',
      createdAt: Date.now(),
    };

    await storePendingTx('commit-123', mockTx);

    expect(mockRedisInstance.setex).toHaveBeenCalledWith(
      'pending:tx:commit-123',
      300,
      expect.any(String)
    );
  });

  it('should retrieve pending transaction', async () => {
    const { getPendingTx } = await import('../redis.js');

    const mockTx = {
      signedTx: { txID: 'test123' },
      quoteId: 'quote-123',
      userAddress: 'TTestAddress123',
      ipAddress: '127.0.0.1',
      usdtAmount: '10.00',
      trxAmount: '60.00',
      createdAt: 1234567890,
    };

    mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify(mockTx));

    const result = await getPendingTx('commit-123');
    expect(result).toEqual(mockTx);
  });

  it('should return null for non-existent transaction', async () => {
    const { getPendingTx } = await import('../redis.js');

    mockRedisInstance.get.mockResolvedValueOnce(null);

    const result = await getPendingTx('non-existent');
    expect(result).toBeNull();
  });

  it('should delete pending transaction', async () => {
    const { deletePendingTx } = await import('../redis.js');

    await deletePendingTx('commit-123');

    expect(mockRedisInstance.del).toHaveBeenCalledWith('pending:tx:commit-123');
  });

  it('should list pending transaction IDs', async () => {
    const { listPendingTxIds } = await import('../redis.js');

    mockRedisInstance.keys.mockResolvedValueOnce([
      'pending:tx:commit-1',
      'pending:tx:commit-2',
    ]);

    const ids = await listPendingTxIds();
    expect(ids).toEqual(['commit-1', 'commit-2']);
  });

  it('should get TTL for pending transaction', async () => {
    const { getTTL } = await import('../redis.js');

    mockRedisInstance.ttl.mockResolvedValueOnce(250);

    const ttl = await getTTL('commit-123');
    expect(ttl).toBe(250);
  });
});
