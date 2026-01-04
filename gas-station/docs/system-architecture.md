# Gas Station - System Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        END USERS                                 │
│  ┌──────────────┐           ┌──────────────┐                    │
│  │ Solana Users │           │ TRON Users   │                    │
│  │ (Phantom,    │           │ (TronLink,   │                    │
│  │ Solflare)    │           │ WalletConnect)                   │
│  └──────┬───────┘           └──────┬───────┘                    │
└─────────┼─────────────────────────┼─────────────────────────────┘
          │                         │
          │ HTTPS                   │ HTTPS
          │                         │
┌─────────▼─────────────────────────▼─────────────────────────────┐
│                      FRONTEND (Vercel)                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ React 18 + Vite 6                                          │ │
│  │ ├─ Home.tsx (TRON primary UX)                             │ │
│  │ ├─ Admin.tsx (Admin dashboard)                            │ │
│  │ ├─ Hooks (useTronWallet, useTronTransaction, etc)        │ │
│  │ └─ Components (ChainSelector, AmountInput, etc)          │ │
│  │                                                           │ │
│  │ TailwindCSS Styling                                       │ │
│  │ React Router v7 Navigation                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ API Client (services/api.ts)                              │ │
│  │ ├─ solanaApi.quote()                                      │ │
│  │ ├─ solanaApi.buildTx()                                    │ │
│  │ ├─ solanaApi.submit()                                     │ │
│  │ ├─ tronApi.* (quote, buildTx, commit, execute, submit)  │ │
│  │ └─ adminApi.* (stats, flagged, blacklist)               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    HTTPS (CORS restricted)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     BACKEND (Railway)                            │
│                   Express.js Port 3001                           │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Routes                                                     │  │
│  │ ├─ GET  /health                 (health check)            │  │
│  │ ├─ POST /api/solana/*           (Solana endpoints)        │  │
│  │ ├─ POST /api/tron/*             (TRON endpoints)          │  │
│  │ └─ GET  /api/admin/*            (Admin endpoints)         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Middleware Stack                                           │  │
│  │ 1. CORS (origin: FRONTEND_URL)                             │  │
│  │ 2. JSON Parser                                             │  │
│  │ 3. Rate Limiter (10 req/min per IP)                        │  │
│  │ 4. Route Handlers                                          │  │
│  │ 5. Error Handler (global)                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Services                                                   │  │
│  │ ├─ solana/                                                 │  │
│  │ │  ├─ config.ts    (Connection, fee payer)                │  │
│  │ │  ├─ quote.ts     (Price calculation)                    │  │
│  │ │  ├─ transaction-builder.ts                              │  │
│  │ │  └─ submit.ts    (Broadcast & confirm)                  │  │
│  │ ├─ tron/                                                  │  │
│  │ │  ├─ config.ts                                           │  │
│  │ │  ├─ quote.ts     (Price + provider selection)           │  │
│  │ │  ├─ transaction-builder.ts                              │  │
│  │ │  ├─ tx-decoder.ts (Validate signed TX)                  │  │
│  │ │  ├─ submit.ts    (Broadcast)                            │  │
│  │ │  ├─ commit-reveal.ts (2-phase execution)                │  │
│  │ │  └─ energy-providers/                                   │  │
│  │ │     ├─ index.ts       (EnergyManager)                   │  │
│  │ │     ├─ apitrx.ts      (Primary)                         │  │
│  │ │     └─ tronsave.ts    (Fallback)                        │  │
│  │ ├─ redis.ts        (Cache client)                          │  │
│  │ └─ abuse-tracker.ts (Fraud detection)                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Database Layer (db/)                                       │  │
│  │ ├─ init.ts       (Pool, schema initialization)             │  │
│  │ ├─ schema.sql    (5 tables, 10 indexes)                   │  │
│  │ └─ transactions.ts (CRUD operations)                      │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                        │         │         │
            ┌───────────┘         │         └───────────┐
            │                     │                     │
            ▼                     ▼                     ▼
   ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐
   │   PostgreSQL    │  │    Redis         │  │  Blockchain    │
   │   (External)    │  │   (External)     │  │  RPCs          │
   │                 │  │                  │  │                │
   │ • transactions  │  │ • pending TXs    │  │ • Solana RPC   │
   │ • service_      │  │ • rate limits    │  │ • TRON RPC     │
   │   wallets       │  │ • temp data      │  │ • Jupiter API  │
   │ • rate_limits   │  │ (5min TTL)       │  │                │
   │ • user_stats    │  └──────────────────┘  └────────────────┘
   │ • abuse_        │
   │   incidents     │                              ▼
   └─────────────────┘                   ┌─────────────────────┐
                                        │  Energy Providers   │
                                        │                     │
                                        │ • APITRX (primary)  │
                                        │ • Tronsave (backup) │
                                        └─────────────────────┘
```

## Data Flow Diagrams

### Solana Top-Up Flow (Fee Payer Model)

```
USER FRONTEND                          BACKEND                    SOLANA BLOCKCHAIN
┌──────────────┐                   ┌──────────────┐              ┌─────────────────┐
│              │                   │              │              │                 │
│ User enters  │                   │              │              │                 │
│ USDC amount  │──────────────────▶│ quote()      │              │                 │
│              │                   │ (getPrices)  │──────────────▶│ Check SOL price │
│              │                   │ (calcFees)   │◀──────────────│                 │
│              │◀──────────────────│ return Quote │              │                 │
│              │                   │              │              │                 │
│ User clicks  │                   │              │              │                 │
│ "Confirm"    │────────────────────▶ buildTx()  │              │                 │
│              │                   │ (create TX) │              │                 │
│              │◀────────────────────│ return UXN │              │                 │
│              │                   │ + transID   │              │                 │
│              │                   │              │              │                 │
│ User signs   │                   │              │              │                 │
│ via Phantom  │                   │              │              │                 │
│              │                   │              │              │                 │
│ User submits │──────────────────▶│ submit()    │              │                 │
│ signed TX    │                   │ (store sig) │              │                 │
│              │                   │ (broadcast) │──────────────▶│ Fee payer signs │
│              │                   │ (pollConf.) │               │ (broadcasts)    │
│              │◀──────────────────│ return hash │◀──────────────│ Confirms        │
│              │                   │              │              │                 │
│ Display      │                   │              │              │                 │
│ "Complete"   │                   │              │              │                 │
│              │                   │              │              │                 │
└──────────────┘                   └──────────────┘              └─────────────────┘

Key Detail: Service pays transaction fee, user pays stablecoin cost
```

### TRON Top-Up Flow (Energy Delegation + Commit-Reveal)

```
USER FRONTEND                    BACKEND                       ENERGY PROVIDERS
┌──────────────┐            ┌──────────────┐                ┌──────────────────┐
│              │            │              │                │                  │
│ User enters  │            │              │                │                  │
│ USDT amount  │───────────▶│ quote()      │                │                  │
│              │            │ (get prices) │                │                  │
│              │◀───────────│ (select      │                │                  │
│              │            │  provider)   │                │                  │
│              │            │              │                │                  │
│ User clicks  │            │              │                │                  │
│ "Confirm"    │───────────▶│ buildTx()    │                │                  │
│              │            │ (create TX)  │                │                  │
│              │◀───────────│ return hexTX │                │                  │
│              │            │              │                │                  │
│ User signs   │            │              │                │                  │
│ via TronLink │            │              │                │                  │
│              │            │              │                │                  │
│ User posts   │            │              │                │                  │
│ signed TX    │───────────▶│ commit()     │                │                  │
│              │            │ (validate)   │                │                  │
│              │            │ (store in    │                │                  │
│              │            │  Redis 5min) │                │                  │
│              │◀───────────│ return OK    │                │                  │
│              │            │              │                │                  │
│ User clicks  │            │              │                │                  │
│ "Execute"    │───────────▶│ execute()    │                │                  │
│              │            │ (retrieve)   │                │                  │
│              │            │ (delegate    │───────────────▶│ Delegate energy  │
│              │            │  energy)     │◀───────────────│ (APITRX/Tronsave)│
│              │            │ (broadcast)  │                │                  │
│              │            │ (poll confs) │─────────────────────────────────▶
│              │            │              │                   TRON Blockchain
│              │◀───────────│ return hash  │                                    │
│              │            │              │◀─────────────────────────────────  │
│              │            │              │                  Confirmed        │
│ Display      │            │              │                                    │
│ "Complete"   │            │              │                                    │
└──────────────┘            └──────────────┘                └──────────────────┘

Key Detail: User signs first (commit), then service executes with delegated energy
```

## Component Interactions

### Quote to Transaction Flow

```
Frontend                Backend                Database
┌─────┐             ┌────────┐              ┌──────────┐
│quote│────POST────▶│quote() │              │          │
└─────┘             │        │              │          │
                    │ • Check amount        │          │
                    │ • Fetch price         │          │
                    │ • Calculate fees      │          │
                    │ • Check rate limit    │───UX────▶│ (read only)
                    │ • Return quote        │          │
                    │ ┌──────────────────┐  │          │
                    │ │ serviceFee       │  │          │
                    │ │ networkFee       │  │          │
                    │ │ totalCharged     │  │          │
                    │ │ expiresAt (30s)  │  │          │
                    │ └──────────────────┘  │          │
                    └────────┬───────────────┘          │
                             │                          │
                             │ (cached 30s)             │
                             ▼                          │
                    ┌────────────────┐                  │
                    │buildTx()       │                  │
                    │ • Load quote    │                  │
                    │ • Create TX     │                  │
                    │ • Sign if fee   │                  │
                    │   payer (sol)   │                  │
                    │ • Store for     │──────INSERT─────▶│
                    │   tracking      │                  │
                    └────────┬────────┘                  │
                             │                          │
                             │ (unsigned TX)            │
                             │ (or signed                │
                             │  with fee payer)         │
                             ▼                          │
                    ┌────────────────┐                  │
                    │submit()        │                  │
                    │ • Verify sig   │                  │
                    │ • Broadcast    │──────UPDATE─────▶│ status: processing
                    │ • Poll confirm │                  │
                    │ • Update DB    │──────UPDATE─────▶│ status: completed
                    │               │                  │  txHash, feeCost
                    └────────────────┘                  │
                                                        │
                                                        └──────────┘
```

## Service Wallet Architecture

### Solana Service Wallet
- **Role:** Fee payer for all transactions
- **Funding:** Receives USDC from users → sells for SOL
- **Lifecycle:**
  1. Service operator seeds with SOL
  2. Users send USDC to wallet
  3. Service maintains minimum SOL balance
  4. Periodic sweep of USDC to operator

### TRON Service Wallet
- **Role:** Recipient of USDT transfers
- **Energy:** Delegates energy to users
- **Lifecycle:**
  1. Service operator seeds with TRX
  2. Users send USDT to wallet
  3. Providers delegate energy to user wallets
  4. Service broadcasts user-signed transaction

## State Management

### Backend State
- **Stateless:** Each request independent
- **Session State:** Redis (5-min TTL for pending TXs)
- **Persistent State:** PostgreSQL for transactions, users, audit log
- **In-Memory:** Rate limit counters (with DB backup)

### Frontend State
- **React State:** Form input, UI state
- **Local Storage:** Admin API key, user preferences
- **No Cache:** Real-time quote/status via API polling

## Error Handling Flow

```
Request
  │
  ▼
┌────────────────┐
│ Input Validate │
└────┬───────────┘
     │ Invalid
     ├────────────────▶ 400 Bad Request
     │
     │ Valid
     ▼
┌────────────────┐
│ Rate Limit     │
└────┬───────────┘
     │ Limited
     ├────────────────▶ 429 Too Many Requests
     │
     │ OK
     ▼
┌────────────────┐
│ Business Logic │
└────┬───────────┘
     │ AppError
     ├────────────────▶ 4xx + { error, code }
     │
     │ Unexpected Error
     ├────────────────▶ 500 Internal Server Error
     │
     │ Success
     ▼
    200 + data
```

## Security Architecture

### Input Validation Layer
- Zod schemas on all route handlers
- Type-safe request parsing
- Reject unknown fields

### Rate Limiting Layer
- Per-IP sliding window (1 min)
- Database-backed for consistency
- Configurable limits

### Authentication Layer
- Admin endpoints: X-Admin-Key header
- User addresses: Blockchain signature verification
- CORS: Origin whitelist

### Database Security
- Parameterized queries (prevent SQL injection)
- Row-level visibility (no cross-wallet data leakage)
- Audit trail (all transactions logged)

### Blockchain Interaction
- Signature verification before broadcast
- Address validation
- Transaction limits ($500 max)

## Scaling Considerations

### Horizontal Scaling
```
┌─────────────────────────────────────┐
│      Load Balancer (Railway)        │
├────────────┬──────────┬─────────────┤
│            │          │             │
▼            ▼          ▼             ▼
API-1        API-2      API-3    API-N
(Express)    (Express)  (Express) (Express)
│            │          │             │
└────────────┴──────────┴─────────────┘
             │
     ┌───────┴────────┐
     │                │
     ▼                ▼
  PostgreSQL        Redis
  (Shared)          (Shared)
```

- **Stateless APIs:** Horizontal scaling without session affinity
- **Shared Database:** Single PostgreSQL instance (with optional replication)
- **Shared Cache:** Single Redis instance (with optional Sentinel)
- **Load Balancer:** Railway or Cloudflare

### Vertical Scaling
- Database: Connection pooling
- Cache: Memory optimization
- API: Node.js clustering (if needed)

### Rate Limiting at Scale
- Current: Database-backed per-IP
- Future: Distributed cache (Redis) for lower latency
- Risk: Clock skew across instances (mitigated by DB)

## Disaster Recovery

### Database Backup
- PostgreSQL automated backups (Railway)
- Retention: 7+ days
- Testing: Weekly restore verification

### Code Backup
- Git repository (GitHub)
- Multiple branches
- Tags for releases

### Incident Response
- Health check: `/health` endpoint
- Manual monitoring: Datadog/LogRocket
- Fallback: Switch to backup energy provider (TRON)

## Monitoring & Observability

### Metrics to Track
- Request count by endpoint
- Error rate by type (validation, rate limit, server)
- Response time (P50, P95, P99)
- Transaction success rate by chain
- Provider fallback frequency (TRON)
- Rate limit hits per hour
- Database query performance

### Logging
- Backend: Console logs → CloudWatch (Railway)
- Frontend: Error tracking → Sentry
- Database: Slow query log
- Blockchain: Transaction status cache

### Alerting
- Server errors (5xx) → Slack
- Rate limit exceeded → Dashboard
- Database down → Ops oncall
- Provider failure → Investigation

---

**Document Version:** 1.0
**Last Updated:** 2026-01-03
**Status:** Active (MVP Phase)
