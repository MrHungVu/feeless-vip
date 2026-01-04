import { useState, useCallback } from 'react';

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

interface Stats {
  totalUsers: number;
  flaggedUsers: number;
  blacklistedUsers: number;
  totalAbandons: number;
}

export function Admin() {
  const [apiKey, setApiKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [flaggedUsers, setFlaggedUsers] = useState<UserStats[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { 'x-admin-key': apiKey };

      const [statsRes, usersRes, incidentsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers }),
        fetch(`${API_URL}/api/admin/flagged`, { headers }),
        fetch(`${API_URL}/api/admin/incidents?limit=20`, { headers })
      ]);

      if (!statsRes.ok || !usersRes.ok || !incidentsRes.ok) {
        throw new Error('Unauthorized');
      }

      const statsData = await statsRes.json();
      const users = await usersRes.json();
      const incs = await incidentsRes.json();

      setStats(statsData);
      setFlaggedUsers(users.users);
      setIncidents(incs.incidents);
      setAuthenticated(true);
    } catch {
      setError('Failed to fetch data. Check API key.');
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const handleAction = useCallback(async (wallet: string, action: 'unflag' | 'blacklist' | 'unblacklist') => {
    try {
      await fetch(`${API_URL}/api/admin/users/${wallet}/${action}`, {
        method: 'POST',
        headers: { 'x-admin-key': apiKey }
      });
      fetchData();
    } catch {
      setError('Action failed');
    }
  }, [apiKey, fetchData]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchData();
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
            onKeyDown={handleKeyDown}
            className="w-full p-2 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
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
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button
            onClick={() => setAuthenticated(false)}
            className="text-red-400 hover:underline"
          >
            Logout
          </button>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total Users</p>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">Flagged</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.flaggedUsers}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-red-400 text-sm">Blacklisted</p>
              <p className="text-2xl font-bold text-red-400">{stats.blacklistedUsers}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total Abandons</p>
              <p className="text-2xl font-bold">{stats.totalAbandons}</p>
            </div>
          </div>
        )}

        {/* Flagged Users */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">
            Flagged Users ({flaggedUsers.length})
          </h2>
          {flaggedUsers.length === 0 ? (
            <p className="text-gray-500">No flagged users</p>
          ) : (
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
          )}
        </div>

        {/* Recent Incidents */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Recent Incidents</h2>
          {incidents.length === 0 ? (
            <p className="text-gray-500">No incidents recorded</p>
          ) : (
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
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
}
