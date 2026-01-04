import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock pool
const mockQuery = vi.fn();

vi.mock('../../db/init.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

// Import after mock
import {
  trackRequest,
  trackCompletion,
  trackAbandonment,
  getUserStats,
  isBlacklisted,
  isFlagged,
  setUserFlag,
  setBlacklist,
  getFlaggedUsers,
  getIncidents,
  getStats,
} from '../abuse-tracker.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Abuse Tracker Service', () => {
  describe('trackRequest', () => {
    it('should insert new user stats with IP', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await trackRequest('TTestWallet123', '192.168.1.1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_stats'),
        ['TTestWallet123', '192.168.1.1']
      );
    });
  });

  describe('trackCompletion', () => {
    it('should increment completed count', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await trackCompletion('TTestWallet123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('completed_count = completed_count + 1'),
        ['TTestWallet123']
      );
    });
  });

  describe('trackAbandonment', () => {
    it('should increment abandoned count and log incident', async () => {
      // Mock for update abandoned_count
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock for insert incident
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock for getUserStats
      mockQuery.mockResolvedValueOnce({
        rows: [{
          wallet_address: 'TTestWallet123',
          ip_addresses: ['192.168.1.1'],
          abandoned_count: 1,
          flagged: false,
        }],
      });
      // Mock for IP abandonment check
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      // Mock for wallets per IP check
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await trackAbandonment('TTestWallet123', '192.168.1.1');

      expect(mockQuery).toHaveBeenCalledTimes(5);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('abandoned_count = abandoned_count + 1'),
        ['TTestWallet123']
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO abuse_incidents'),
        ['TTestWallet123', '192.168.1.1']
      );
    });

    it('should flag user after 3+ abandonments', async () => {
      // Mock for update abandoned_count
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock for insert incident
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock for getUserStats - user has 3 abandonments now
      mockQuery.mockResolvedValueOnce({
        rows: [{
          wallet_address: 'TTestWallet123',
          ip_addresses: ['192.168.1.1'],
          abandoned_count: 3,
          flagged: false,
        }],
      });
      // Mock for IP abandonment check
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      // Mock for wallets per IP check
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      // Mock for setUserFlag
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await trackAbandonment('TTestWallet123', '192.168.1.1');

      // Should have called setUserFlag
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_stats SET flagged'),
        ['TTestWallet123', true, expect.stringContaining('abandonments')]
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user stats when found', async () => {
      const mockStats = {
        wallet_address: 'TTestWallet123',
        ip_addresses: ['192.168.1.1'],
        total_requests: 5,
        completed_count: 3,
        abandoned_count: 1,
        flagged: false,
        flag_reason: null,
        blacklisted: false,
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await getUserStats('TTestWallet123');

      expect(result).toEqual(mockStats);
    });

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getUserStats('NonExistent');

      expect(result).toBeNull();
    });
  });

  describe('isBlacklisted', () => {
    it('should return true for blacklisted wallet', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ '1': 1 }] });

      const result = await isBlacklisted('TBlacklistedWallet', '192.168.1.1');

      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted wallet', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await isBlacklisted('TGoodWallet', '192.168.1.1');

      expect(result).toBe(false);
    });
  });

  describe('isFlagged', () => {
    it('should return true for flagged wallet', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ flagged: true }] });

      const result = await isFlagged('TFlaggedWallet');

      expect(result).toBe(true);
    });

    it('should return false for non-flagged wallet', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ flagged: false }] });

      const result = await isFlagged('TGoodWallet');

      expect(result).toBe(false);
    });
  });

  describe('setUserFlag', () => {
    it('should update user flag status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await setUserFlag('TTestWallet', true, 'Suspicious activity');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_stats SET flagged'),
        ['TTestWallet', true, 'Suspicious activity']
      );
    });
  });

  describe('setBlacklist', () => {
    it('should update user blacklist status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await setBlacklist('TTestWallet', true);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_stats SET blacklisted'),
        [true, 'TTestWallet']
      );
    });
  });

  describe('getFlaggedUsers', () => {
    it('should return all flagged users', async () => {
      const mockUsers = [
        { wallet_address: 'TFlagged1', flagged: true, abandoned_count: 5 },
        { wallet_address: 'TFlagged2', flagged: true, abandoned_count: 3 },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockUsers });

      const result = await getFlaggedUsers();

      expect(result).toEqual(mockUsers);
    });
  });

  describe('getIncidents', () => {
    it('should return incidents with optional filters', async () => {
      const mockIncidents = [
        { id: '1', wallet_address: 'TTest', incident_type: 'abandoned' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockIncidents });

      const result = await getIncidents('TTest', undefined, 10);

      expect(result).toEqual(mockIncidents);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('wallet_address = $1'),
        ['TTest', 10]
      );
    });
  });

  describe('getStats', () => {
    it('should return aggregate stats', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '100' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '15' }] });

      const result = await getStats();

      expect(result).toEqual({
        totalUsers: 100,
        flaggedUsers: 5,
        blacklistedUsers: 2,
        totalAbandons: 15,
      });
    });
  });
});
