# Gas Station - Project Overview & Product Development Requirements

## Executive Summary

**Gas Station** is a monorepo Web3 service that enables cryptocurrency users to obtain native blockchain tokens (SOL on Solana, TRX on TRON) without paying transaction fees by exchanging stablecoins (USDC on Solana, USDT on TRON). The service implements blockchain-specific fee delegation patterns: fee payer model for Solana and energy delegation for TRON.

## Product Vision

**Problem:** Users who have stablecoins but no native tokens cannot pay blockchain transaction fees, creating a barrier to entry for Web3 adoption.

**Solution:** Gas Station provides fee-less token exchanges using blockchain-native fee delegation mechanisms, funded by a service operator who monetizes through spread fees.

**Target Users:** New Web3 users, USDC/USDT holders seeking SOL/TRX, mobile wallet users, light wallet operators.

## Core Features

### 1. Stablecoin to Native Token Exchange

| Feature | Solana | TRON |
|---------|--------|------|
| **Stablecoin** | USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v) | USDT (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t) |
| **Fee Pattern** | Fee Payer Model | Energy Delegation |
| **Quote Expires** | 30 seconds | 30 seconds |
| **Max TX Amount** | $500 USD | $500 USD |

### 2. Fee Payer Pattern (Solana)

- Service wallet maintains SOL balance to pay transaction fees
- User signs transaction paying USDC to service wallet
- Service broadcasts transaction with fee payer signature
- Funds received as USDC, service gains spread margin

### 3. Energy Delegation (TRON)

- Service wallet delegates energy/bandwidth to user wallet
- Commit-Reveal Flow: User signs transaction first, then service executes with delegated energy
- Prevents fund loss if execution fails
- Supports multiple energy providers (APITRX primary, Tronsave fallback)

### 4. Multi-Provider Energy Management (TRON)

**Available Providers:**
- **APITRX** (Primary): Fast, reliable, ~2.5 TRX/transaction cost
- **Tronsave** (Fallback): Backup provider, ~3.5 TRX/transaction cost
- **Extensible:** Architecture supports adding providers

**Provider Features:**
- Automatic fallback if primary provider fails
- Provider health monitoring
- Dynamic provider selection
- Provider-specific error handling

### 5. Abuse Detection & Prevention

| Mechanism | Trigger | Action |
|-----------|---------|--------|
| **Abandoned Transactions** | 3+ pending > 5 min | Flag wallet |
| **Multi-IP/Wallet** | Same wallet from 5+ IPs in 24h | Flag for review |
| **Rate Limiting** | >10 requests/min from IP | 429 Too Many Requests |
| **Blacklist Control** | Manual admin action | Block wallet permanently |

**Tracking Data:**
- Per-wallet: request count, completed/abandoned ratio, IP address history
- Per-IP: transaction volume, associated wallets
- Incidents: detailed logs of suspicious behavior

### 6. Admin Dashboard

**Authentication:** X-Admin-Key header with hardcoded key

**Capabilities:**
- View flagged wallets and abuse incidents
- Blacklist/whitelist management
- Real-time transaction statistics
- User behavior analytics

## Non-Functional Requirements

### Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Quote Response | < 500ms | RPC call + calculation |
| Build TX Response | < 1s | TX construction |
| Submit Response | < 2s | Blockchain broadcast |
| Throughput | 10 tx/min per IP | Rate limit configurable |

### Security

- **Private Keys:** Environment variables (upgrade to KMS for production)
- **Rate Limiting:** Per-IP, per-minute window
- **Transaction Caps:** $500 USD max
- **Audit Trail:** All transactions logged with status history
- **Input Validation:** Zod schema validation on all endpoints
- **CORS:** Restricted to configured frontend URL

### Reliability

- **Multi-Provider Fallback:** APITRX → Tronsave for TRON
- **Transaction Logging:** Full audit trail in PostgreSQL
- **Graceful Degradation:** Continues without DB if unavailable
- **Health Checks:** `/health` endpoint for monitoring

### Scalability

- **Horizontal Scaling:** Stateless Express API
- **Database:** PostgreSQL with connection pooling
- **Caching:** Redis for transaction state (5-minute TTL)
- **Indexing:** Optimized indexes on frequently queried columns

## Technical Requirements

### Architecture Constraints

- **Monorepo Structure:** Three packages (backend, frontend, shared)
- **Language:** TypeScript 5 across all packages
- **Framework:** Express 4 (backend), React 18 + Vite 6 (frontend)
- **Database:** PostgreSQL 14+
- **Cache:** Redis

### Deployment

| Component | Platform | Config |
|-----------|----------|--------|
| **Backend** | Railway | Dockerfile, port 3001 |
| **Frontend** | Vercel | vercel.json, SPA |
| **Database** | External | DATABASE_URL |
| **Cache** | External | REDIS_URL |

### Environment Variables

**Database & Cache:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Server port (default 3001)
- `FRONTEND_URL` - CORS origin

**Solana:**
- `SOLANA_RPC_URL` - RPC endpoint
- `SOLANA_FEE_PAYER_PRIVATE_KEY` - Base58-encoded fee payer private key
- `USDC_MINT_SOLANA` - USDC token mint address

**TRON:**
- `TRON_API_URL` - TronGrid or compatible RPC
- `TRON_PRIVATE_KEY` - Hex-encoded service wallet private key
- `SERVICE_WALLET_TRON` - Service wallet address
- `USDT_CONTRACT_TRON` - USDT contract address

**Energy Providers:**
- `APITRX_API_KEY` - APITRX API credentials
- `TRONSAVE_API_KEY` - Tronsave API credentials

**Configuration:**
- `MAX_TX_AMOUNT_USD` - Maximum transaction value (default 500)
- `RATE_LIMIT_PER_MIN` - Requests per minute per IP (default 10)
- `ADMIN_API_KEY` - Admin dashboard authentication

## API Contract

### Solana Endpoints

**POST /api/solana/quote**
- Get fee estimate for USDC → SOL swap
- Input: stablecoinAmount
- Output: Quote with native amount, fees, expiration
- Response: 200 ms typical

**POST /api/solana/build-tx**
- Build unsigned transaction for user signature
- Input: userAddress, stablecoinAmount
- Output: transactionId, unsignedTx (base64), quote
- Note: User must sign with their Phantom/Solflare wallet

**POST /api/solana/submit**
- Submit signed transaction for broadcast
- Input: transactionId, signedTx
- Output: txHash, status
- Wallet must have sufficient USDC

**GET /api/solana/tx/:id**
- Poll transaction status
- Returns: full transaction object with status/hash/fees

### TRON Endpoints

**GET /api/tron/providers**
- List available energy providers
- Returns: provider array with name, status, pricing

**POST /api/tron/quote**
- Get fee estimate for USDT → TRX swap
- Input: stablecoinAmount, (optional) preferredProvider
- Output: Quote with native amount, provider fees, expiration

**POST /api/tron/build-tx**
- Build unsigned transaction for user signature
- Input: userAddress, stablecoinAmount, (optional) preferredProvider
- Output: transactionId, unsignedTx (hex), quote

**POST /api/tron/commit**
- Store signed transaction securely for execution
- Input: transactionId, signedTx (hex), userAddress
- Output: commitId, validUntil
- Note: Commit-Reveal flow - user signs first

**POST /api/tron/execute**
- Execute previously committed transaction with delegated energy
- Input: commitId
- Output: txHash, status, energyUsed
- Service broadcasts with delegated energy

**POST /api/tron/submit**
- Legacy endpoint: broadcast pre-signed TRON transaction
- Input: transactionId, signedTx
- Output: txHash, status

**GET /api/tron/tx/:id**
- Poll transaction status with full details

### Admin Endpoints

All admin endpoints require `x-admin-key` header matching `ADMIN_API_KEY`.

**GET /api/admin/stats**
- Overview statistics: total transactions, volume, success rate

**GET /api/admin/flagged**
- List flagged wallets: address, reason, incident count

**GET /api/admin/blacklisted**
- List permanently blacklisted wallets

**GET /api/admin/incidents**
- Audit log of all abuse incidents with timestamps

**POST /api/admin/users/:wallet/flag**
- Manually flag a wallet

**POST /api/admin/users/:wallet/blacklist**
- Permanently blacklist a wallet

**POST /api/admin/users/:wallet/whitelist**
- Remove flag/blacklist

### Health Endpoint

**GET /health**
- Returns: { status: "ok", timestamp }
- Used for load balancer health checks

## Database Schema

### transactions
- `id` (UUID) - Primary key
- `chain` - 'solana' | 'tron'
- `tx_type` - 'topup' | 'send'
- `user_address` - User's public key/address
- `stablecoin_amount` - Amount of USDC/USDT
- `native_amount` - Calculated SOL/TRX output
- `fee_charged` - Total stablecoin fees
- `fee_cost` - Actual on-chain fee cost
- `tx_hash` - Confirmed transaction hash
- `status` - pending | processing | completed | failed
- `created_at`, `completed_at` - Timestamps

### service_wallets
- `id` (UUID)
- `chain` - Unique per chain
- `address` - Service wallet address
- `native_balance` - Cached SOL/TRX balance
- `stablecoin_balance` - Cached USDC/USDT balance
- `last_checked` - Balance sync timestamp

### rate_limits
- `identifier` - IP address or user ID
- `request_count` - Requests in current window
- `window_start` - Sliding window timestamp

### user_stats
- `wallet_address` (PK) - User's address
- `ip_addresses` - Array of IPs user accessed from
- `total_requests` - Lifetime request count
- `completed_count` - Successful transactions
- `abandoned_count` - Pending > 5 min
- `flagged` - Boolean abuse flag
- `flag_reason` - Abuse reason text
- `blacklisted` - Permanent ban

### abuse_incidents
- `id` (UUID)
- `wallet_address` - Flagged wallet
- `ip_address` - Associated IP
- `incident_type` - Type of violation
- `details` (JSONB) - Incident metadata
- `created_at` - Timestamp

## Success Metrics

### Business Metrics
- **Monthly Active Users:** Target 1,000+ by month 6
- **Transaction Volume:** Target $50k+ weekly volume
- **Service Fee Revenue:** 1-2% spread margin
- **User Retention:** 40%+ repeat users within 30 days

### Technical Metrics
- **Success Rate:** >99% confirmed transactions
- **Error Rate:** <0.5% failed transactions
- **Response Time:** P95 < 1s for all endpoints
- **Uptime:** 99.9% SLA target

### Security Metrics
- **Fraud Detection:** Flag 95%+ of abuse patterns
- **False Positive Rate:** <5% manual review required
- **Incident Resolution:** <1 hour for blacklist

## Roadmap

### Phase 1: MVP (Current)
- Solana fee payer implementation
- TRON energy delegation
- Multi-provider energy system
- Abuse detection

### Phase 2: Enhanced Security
- Commit-Reveal flow for TRON
- WalletConnect integration for mobile
- Admin dashboard

### Phase 3: Expansion
- Additional chains (Polygon, Arbitrum)
- Batch operations
- Affiliate program
- Advanced analytics

### Phase 4: Production Hardening
- KMS for key management
- Multi-sig for service wallet
- Enhanced rate limiting
- Advanced fraud detection

## Acceptance Criteria

### Must Have
- [ ] Quote endpoint responds in < 500ms
- [ ] Build-TX creates valid, signable transaction
- [ ] Submit endpoint confirms on-chain within 30s
- [ ] Rate limiting enforces 10 req/min per IP
- [ ] Abuse detection flags 3+ abandoned transactions
- [ ] Admin can blacklist wallets
- [ ] Database logs all transactions
- [ ] Health check returns 200 OK

### Should Have
- [ ] Multi-provider fallback for TRON energy
- [ ] Commit-Reveal flow for safer TRON execution
- [ ] WalletConnect support for mobile TRON wallets
- [ ] Admin dashboard UI
- [ ] Transaction status polling

### Nice to Have
- [ ] WebSocket real-time status updates
- [ ] Webhook notifications for integrations
- [ ] Advanced analytics dashboard
- [ ] Provider performance metrics

---

**Document Version:** 1.0
**Last Updated:** 2026-01-03
**Status:** Active (MVP Phase)
