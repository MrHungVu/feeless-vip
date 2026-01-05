import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Schema embedded directly to avoid file path issues in containers
const SCHEMA = `
-- Transactions log
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain VARCHAR(10) NOT NULL CHECK (chain IN ('solana', 'tron')),
  tx_type VARCHAR(20) NOT NULL CHECK (tx_type IN ('topup', 'send')),
  user_address VARCHAR(100) NOT NULL,
  recipient_address VARCHAR(100),
  stablecoin_amount DECIMAL(20,6) NOT NULL,
  native_amount DECIMAL(20,8),
  fee_charged DECIMAL(20,6) NOT NULL,
  fee_cost DECIMAL(20,8),
  tx_hash VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Service wallet balances
CREATE TABLE IF NOT EXISTS service_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain VARCHAR(10) NOT NULL UNIQUE,
  address VARCHAR(100) NOT NULL,
  native_balance DECIMAL(20,8) DEFAULT 0,
  stablecoin_balance DECIMAL(20,6) DEFAULT 0,
  last_checked TIMESTAMP
);

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(100) NOT NULL,
  request_count INT DEFAULT 0,
  window_start TIMESTAMP DEFAULT NOW(),
  UNIQUE(identifier)
);

-- User behavior tracking for abuse detection
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
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_abuse_wallet ON abuse_incidents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_abuse_ip ON abuse_incidents(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_flagged ON user_stats(flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_blacklisted ON user_stats(blacklisted) WHERE blacklisted = TRUE;
`;

export async function initDb() {
  try {
    await pool.query(SCHEMA);
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}
