# Gas Station - Codebase Summary

## Repository Overview

**Gas Station** is a fee-less cryptocurrency exchange service enabling users to swap stablecoins (USDC/USDT) for native tokens (SOL/TRX) without paying transaction fees. The codebase is organized as a monorepo with separate packages for backend API, frontend UI, and shared type definitions.

**Repository Statistics:**
- Total Files: 179 files (50 source files, excluding dist/ and node_modules/)
- Total Tokens: 340,030 tokens (packed representation)
- Main Languages: TypeScript 5, SQL, Markdown, CSS
- Package Manager: npm workspaces
- Build Tool: Vite (frontend), TypeScript (backend)

## Repository Structure

```
gas-station/
├── backend/                    # Express API service
│   ├── src/                   # TypeScript source
│   │   ├── index.ts           # App entry point (1.5 KB)
│   │   ├── db/                # Database layer
│   │   ├── middleware/        # Express middleware
│   │   ├── routes/            # API route handlers
│   │   └── services/          # Business logic
│   ├── dist/                  # Compiled JavaScript (gitignored)
│   └── package.json           # Backend dependencies
├── frontend/                   # React + Vite web app
│   ├── src/                   # TypeScript + TSX source
│   │   ├── main.tsx           # Entry point with wallet setup
│   │   ├── App.tsx            # Router configuration
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable UI components
│   │   ├── hooks/             # Custom React hooks
│   │   └── services/          # API client
│   ├── dist/                  # Built static site (gitignored)
│   └── package.json           # Frontend dependencies
├── shared/                     # Shared type definitions
│   ├── types/                 # TypeScript types & interfaces
│   ├── dist/                  # Built .d.ts files (gitignored)
│   └── package.json
├── docs/                       # Documentation
├── plans/                      # Implementation plans & research
├── package.json               # Workspace root configuration
├── tsconfig.base.json         # Base TypeScript config
├── Dockerfile                 # Backend container (Railway)
├── railway.json               # Railway deployment config
├── vercel.json                # Vercel deployment config
└── repomix-output.xml         # Codebase packed representation
```

## Backend Details

### Technology Stack
- **Runtime:** Node.js 20+
- **Framework:** Express.js 4
- **Language:** TypeScript 5
- **Database:** PostgreSQL 14+
- **Cache:** Redis
- **Blockchain SDKs:** @solana/web3.js, tronweb

### Source Structure (28 TypeScript files)

**Core Entry (1 file):**
- `index.ts` - Express app initialization, middleware setup, route registration

**Database Layer (4 files):**
- `db/init.ts` - PostgreSQL pool initialization, schema loading
- `db/migrate.ts` - Migration entry point
- `db/schema.sql` - 5 tables with 10 optimized indexes
- `db/transactions.ts` - Transaction CRUD operations (4 functions)

**Middleware (3 files):**
- `middleware/error-handler.ts` - AppError class, global error handler
- `middleware/rate-limiter.ts` - 10 req/min per IP sliding window
- `middleware/validate.ts` - Zod request body validation

**Routes (4 files):**
- `routes/health.ts` - GET /health status endpoint
- `routes/solana.ts` - POST /api/solana/* (quote, build-tx, submit, tx/:id)
- `routes/tron.ts` - POST /api/tron/* (quote, build-tx, commit, execute, submit, tx/:id, service-wallet, providers)
- `routes/admin.ts` - GET/POST /api/admin/* (stats, flagged, blacklisted, incidents, users/:wallet/*)

**Solana Service (4 files):**
- `services/solana/config.ts` - RPC connection, fee payer keypair, USDC mint
- `services/solana/quote.ts` - Calculate SOL output from USDC input (2% margin)
- `services/solana/transaction-builder.ts` - Construct fee payer transfer transaction
- `services/solana/submit.ts` - Broadcast transaction, poll confirmation

**TRON Service (9 files):**
- `services/tron/config.ts` - TronWeb initialization, service wallet setup
- `services/tron/quote.ts` - Calculate TRX output from USDT input with provider selection
- `services/tron/transaction-builder.ts` - Construct USDT transfer transaction
- `services/tron/submit.ts` - Broadcast transaction, poll confirmation
- `services/tron/tx-decoder.ts` - Validate signed transaction structure
- `services/tron/commit-reveal.ts` - 2-phase execution: sign → commit → execute
- `services/tron/energy-providers/types.ts` - EnergyProvider interface definition
- `services/tron/energy-providers/index.ts` - EnergyManager with failover logic
- `services/tron/energy-providers/apitrx.ts` - APITRX provider implementation
- `services/tron/energy-providers/tronsave.ts` - Tronsave provider implementation

**Shared Services (2 files):**
- `services/redis.ts` - Redis client initialization, key-value operations
- `services/abuse-tracker.ts` - Wallet flagging, pattern detection (3+ abandons, multi-IP)

**Tests (2 files):**
- `services/__tests__/redis.test.ts` - Unit tests for Redis operations
- `services/__tests__/abuse-tracker.test.ts` - Unit tests for abuse detection

### Database Schema

**5 Tables:**

1. **transactions** (10 columns)
   - UUID primary key, chain, type, user/recipient addresses
   - Amounts (stablecoin, native, fees)
   - Status tracking, error messages, timestamps

2. **service_wallets** (6 columns)
   - Per-chain wallet info (address, balances, last sync)

3. **rate_limits** (4 columns)
   - Per-IP request counting, sliding window

4. **user_stats** (10 columns)
   - Per-wallet statistics: request history, completion rate
   - Abuse flags and reasons, blacklist status

5. **abuse_incidents** (5 columns)
   - Incident log: wallet, IP, type, details (JSONB)

**Indexes (10 total):**
- User address lookups (transactions)
- Status filtering (pending, completed, failed)
- Rate limit identifier (IP addresses)
- Abuse flags and incidents
- Timestamp ordering

### Key Patterns & Implementation

**Quote Calculation:**
- Fetch current blockchain prices (Jupiter, CoinGecko)
- Apply 2-3% service fee margin
- Return 30-second expiration window
- Cache in Redis for quote-to-build consistency

**Transaction Lifecycle:**
1. Quote (estimate fees, get expiration)
2. Build-TX (create unsigned/partially-signed transaction)
3. Submit (user signs, service broadcasts, polls confirmation)
4. Track (database logging, status polling)

**Fee Payer Model (Solana):**
- Service wallet holds SOL
- Service signs as fee payer during broadcast
- User only needs to sign USDC transfer
- No user SOL required

**Energy Delegation (TRON):**
- Service wallet delegates energy to user
- Commit-Reveal: User signs first → Server delegates & broadcasts
- Fallback to secondary provider if primary fails
- Energy providers: APITRX (~2.5 TRX cost), Tronsave (~3.5 TRX cost)

**Abuse Detection:**
- Flag wallet after 3+ abandoned transactions
- Flag multi-IP access patterns (5+ IPs in 24h)
- Database-backed tracking with audit log
- Admin manual override/blacklist

## Frontend Details

### Technology Stack
- **Framework:** React 18
- **Build Tool:** Vite 6
- **Language:** TypeScript 5
- **Styling:** TailwindCSS 3
- **Routing:** React Router 7
- **Wallet Integration:** @solana/wallet-adapter-react, @tronweb3/tronwallet-adapter-react-hooks

### Source Structure (15 TypeScript/TSX files)

**App Structure (2 files):**
- `main.tsx` - React 18 root, wallet provider initialization, app mounting
- `App.tsx` - React Router configuration, route definitions

**Pages (2 files):**
- `pages/Home.tsx` - Main TRON top-up interface
- `pages/Admin.tsx` - Admin dashboard (API key login, stats, blacklist)

**Components (8 files):**
- `components/ChainSelector.tsx` - Solana/TRON toggle button
- `components/NetworkSelector.tsx` - Select Devnet/Testnet/Mainnet
- `components/TokenSelector.tsx` - Select USDC/USDT
- `components/AmountInput.tsx` - User input with validation
- `components/QuoteDisplay.tsx` - Show fees, native amount, expiration
- `components/StatusIndicator.tsx` - TX status badge (pending/processing/confirmed/failed)
- `components/TopUpForm.tsx` - Full form composition
- `components/TransactionStatus.tsx` - Status polling modal

**Hooks (4 files):**
- `hooks/useTronWallet.ts` - TronLink + WalletConnect connection, balance polling
- `hooks/useTronTransaction.ts` - Build TX, request signature, submit, poll status
- `hooks/use-tron-topup.ts` - Complete TRON flow: quote → build → sign → submit
- `hooks/use-solana-topup.ts` - Complete Solana flow: quote → build → sign → submit

**Services (1 file):**
- `services/api.ts` - Axios HTTP client with solanaApi/tronApi/adminApi namespaces

### Key UI Patterns

**Form Flow:**
1. User selects chain (Solana/TRON), token (USDC/USDT), amount
2. Real-time quote with fees displayed
3. User clicks "Swap" → wallet connection
4. User signs transaction
5. Status polling → completion notification

**Wallet Integration:**
- Solana: Phantom, Solflare via WalletAdapter
- TRON: TronLink (browser extension), WalletConnect (mobile)
- Balance display, address verification

**Error Handling:**
- Input validation (amount > 0, < 500 USD)
- Network errors → retry with exponential backoff
- Wallet errors → user-friendly messages
- TX failures → show error reason, allow retry

## Shared Package

### Type Definitions (1 file)

**types/index.ts** (52 lines):
- `Chain = 'solana' | 'tron'`
- `TxType = 'topup' | 'send'`
- `TxStatus = 'pending' | 'processing' | 'completed' | 'failed'`
- Interfaces: Quote, TopUpRequest, TopUpResponse, Transaction, BuildTxResponse, SubmitResponse

**Usage:**
- Imported in backend routes and services
- Imported in frontend API client
- Ensures type consistency across monorepo

## Configuration Files

**tsconfig.base.json** - Base TypeScript config for all packages
- `target: ES2020`, `module: ESNext`
- `strict: true`, type-safe development

**backend/tsconfig.json** - Extends base, Node.js resolution

**frontend/tsconfig.json** - Extends base, browser resolution

**frontend/vite.config.ts** - React plugin, path aliases (@/)

**frontend/tailwind.config.js** - TailwindCSS theme customization

**frontend/postcss.config.js** - PostCSS with TailwindCSS

**package.json (root)** - Workspace configuration
- Scripts: dev (concurrent), build (ordered), typecheck, migrate
- Workspace: backend, frontend, shared

## Deployment Configuration

**Dockerfile** - Backend containerization for Railway
- Node.js base image
- Install, build, run on port 3001

**railway.json** - Railway deployment config
- Build command: npm install && npm run build
- Start command: npm run start -w backend

**vercel.json** - Frontend deployment for Vercel
- Build: npm run build -w frontend
- Output: frontend/dist (static site)

## Environment Configuration

**.env.example** - Template with all required variables
- 13 environment variables for database, blockchains, providers, API keys

**Key Variables:**
- DATABASE_URL, REDIS_URL (infrastructure)
- SOLANA_RPC_URL, SOLANA_FEE_PAYER_PRIVATE_KEY, USDC_MINT_SOLANA (Solana)
- TRON_API_URL, TRON_PRIVATE_KEY, SERVICE_WALLET_TRON, USDT_CONTRACT_TRON (TRON)
- APITRX_API_KEY, TRONSAVE_API_KEY (energy providers)
- ADMIN_API_KEY (admin authentication)
- MAX_TX_AMOUNT_USD, RATE_LIMIT_PER_MIN (configuration)

## Development & Build

**Root Scripts:**
- `npm run dev` - Concurrent backend + frontend development (ports 3001, 5173)
- `npm run build` - Build all packages in order (shared → backend → frontend)
- `npm run typecheck` - Type check without emitting
- `npm run migrate` - Run database migrations

**Build Outputs:**
- **Backend:** `backend/dist/` - CommonJS/ESM JavaScript files with source maps
- **Frontend:** `frontend/dist/` - Static HTML + minified assets
- **Shared:** `shared/dist/` - Type definitions (.d.ts) and JavaScript

**TypeScript Compilation:**
- All packages: ESM with source maps
- Strict mode enabled across all packages
- Output targets: ES2020

## Testing

**Test Framework:** Jest (configured in package.json)

**Test Files:**
- `backend/src/services/__tests__/redis.test.ts`
- `backend/src/services/__tests__/abuse-tracker.test.ts`

**Test Patterns:**
- Mock Redis client
- Mock database queries
- Mock blockchain RPCs
- Unit tests for services

## Documentation

**Docs Structure:**
- `docs/project-overview-pdr.md` - Feature overview, requirements, API contract
- `docs/code-standards.md` - Architecture, naming conventions, patterns
- `docs/system-architecture.md` - Diagrams, data flows, security design
- `docs/codebase-summary.md` - This file

**README.md** (174 lines) - Quick start, feature list, tech stack

## Git History & Plans

**Plans Directory:**
- `2026-01-03-commit-reveal-abuse-tracking/` - Latest implementation phase
  - Phase 1-6: Redis setup, abuse tracking, commit-reveal, WalletConnect, frontend, admin
  - Research files on TRON transaction decoding

**Git Branches:**
- `main` - Primary development branch
- Feature/bugfix branches created as needed

## Key Metrics

| Metric | Value |
|--------|-------|
| Total TypeScript Files | 28 (backend) + 15 (frontend) + 1 (shared) = 44 |
| Total Lines of Code | ~5,000-6,000 (excluding dist, node_modules) |
| Database Tables | 5 with 10 indexes |
| API Endpoints | 15+ (Solana, TRON, Admin, Health) |
| Middleware Functions | 3 (CORS, RateLimit, Validate, ErrorHandler) |
| Energy Providers | 2 (APITRX + Tronsave) |
| Supported Chains | 2 (Solana, TRON) |
| Wallet Integrations | 5 (Phantom, Solflare, TronLink, WalletConnect, Ledger) |

## Technology Summary

| Layer | Technology | Count |
|-------|-----------|-------|
| **Language** | TypeScript 5 | 44 files |
| **Frontend** | React 18, Vite 6, TailwindCSS 3, React Router 7 | 15 files |
| **Backend** | Express 4, TypeScript 5, Zod | 28 files |
| **Database** | PostgreSQL 14+ | 5 tables, 10 indexes |
| **Cache** | Redis | 1 client |
| **Blockchain** | Solana Web3.js, TronWeb | 2 chains |
| **Deployment** | Railway (backend), Vercel (frontend) | 2 platforms |

## Quality Assurance

- **Type Safety:** Strict TypeScript across all packages
- **Input Validation:** Zod schemas on all API endpoints
- **Error Handling:** Global error handler + per-service error boundaries
- **Testing:** Unit tests for critical services (redis, abuse-tracker)
- **Documentation:** 4 comprehensive documentation files
- **Code Review:** Git-based workflow with feature branches

---

**Document Version:** 1.0
**Last Updated:** 2026-01-03
**Codebase Snapshot:** repomix-output.xml
**Status:** MVP Phase - Active Development
