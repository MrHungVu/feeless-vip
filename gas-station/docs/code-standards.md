# Gas Station - Code Structure & Standards

## Monorepo Organization

```
gas-station/
├── backend/              # Express API service
├── frontend/             # React + Vite web app
├── shared/              # Shared TypeScript types
├── docs/                # Documentation
├── plans/               # Implementation plans
├── package.json         # Workspace configuration
├── tsconfig.base.json   # Base TypeScript config
└── Dockerfile           # Railway backend deployment
```

## Backend Structure

### Directory Layout

```
backend/src/
├── index.ts                    # Express app initialization
├── db/
│   ├── init.ts                # Database pool & schema setup
│   ├── migrate.ts             # Migration entry point
│   ├── schema.sql             # Database schema (5 tables)
│   └── transactions.ts        # Transaction CRUD operations
├── middleware/
│   ├── error-handler.ts       # Global error handling
│   ├── rate-limiter.ts        # 10 req/min per IP
│   └── validate.ts            # Zod input validation
├── routes/
│   ├── health.ts              # GET /health
│   ├── solana.ts              # POST /api/solana/*
│   ├── tron.ts                # POST /api/tron/*
│   └── admin.ts               # GET/POST /api/admin/* (key auth)
├── services/
│   ├── redis.ts               # Redis client & cache
│   ├── abuse-tracker.ts       # Abuse detection logic
│   ├── solana/
│   │   ├── config.ts          # RPC connection, fees, rates
│   │   ├── quote.ts           # USDC → SOL price calculation
│   │   ├── transaction-builder.ts
│   │   └── submit.ts          # Broadcast transaction
│   └── tron/
│       ├── config.ts          # TronWeb setup, USDT config
│       ├── quote.ts           # USDT → TRX price calculation
│       ├── transaction-builder.ts
│       ├── submit.ts          # Broadcast transaction
│       ├── tx-decoder.ts      # Validate signed transactions
│       ├── commit-reveal.ts   # Secure execution flow
│       └── energy-providers/
│           ├── types.ts       # EnergyProvider interface
│           ├── apitrx.ts      # APITRX implementation
│           ├── tronsave.ts    # Tronsave implementation
│           └── index.ts       # EnergyManager
└── __tests__/                 # Unit tests

backend/dist/                  # Compiled JavaScript (gitignored)
```

### Backend Key Files

#### index.ts - App Entry Point
- Loads environment variables from root `.env`
- Initializes Express app with CORS, JSON middleware
- Registers all route handlers
- Sets up error handler middleware
- Initializes database on startup
- Listens on PORT (default 3001)

**Key Patterns:**
```typescript
// Multi-level env loading for monorepo
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config({ path: resolve(__dirname, '../../../.env') });

// Graceful DB init (continues without DB)
try {
  await initDb();
} catch (error) {
  console.warn('Database init failed (continuing):', error.message);
}
```

#### db/schema.sql - Database Schema
- 5 tables: transactions, service_wallets, rate_limits, user_stats, abuse_incidents
- Proper constraints: CHECK, UNIQUE, FOREIGN KEYS
- Optimized indexes on frequently queried columns (wallet, status, IP)
- Uses TIMESTAMPTZ for timezone-aware timestamps
- JSONB for flexible incident details storage

#### db/transactions.ts - Data Layer
- CRUD functions for transaction lifecycle
- `createTransaction()` - Generate UUID, insert initial record
- `updateTransactionStatus()` - Update status, hash, fees, error
- `getTransaction()` - Fetch by ID
- `getUserTransactions()` - Fetch user's transaction history with limit

#### middleware/validate.ts - Input Validation
- Zod-based request body validation
- Returns 400 with validation errors on failure
- Usage: `router.post('/endpoint', validate(schema), handler)`

#### middleware/rate-limiter.ts - Rate Limiting
- Per-IP sliding window, 1-minute duration
- Configurable via RATE_LIMIT_PER_MIN (default 10)
- Uses database UPSERT for atomicity
- Returns 429 Too Many Requests when exceeded

#### middleware/error-handler.ts - Error Handling
- `AppError` class: statusCode, message, optional code
- Distinguishes AppError from unexpected errors
- Returns structured JSON: `{ error, code }`
- 500 for unhandled exceptions

### Routes Pattern

All route files follow this pattern:

```typescript
import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';

const router = Router();

// POST /api/chain/quote
router.post('/quote', validate(quoteSchema), async (req: Request, res: Response) => {
  const { stablecoinAmount } = req.body;
  const quote = await calculateQuote(stablecoinAmount);
  res.json(quote);
});

export { router as chainRoutes };
```

**Return Structure:**
- Success: 200 with data object
- Validation Error: 400 with `{ error, code }`
- Rate Limited: 429 with `{ error, retryAfter }`
- Not Found: 404 with `{ error }`
- Server Error: 500 with `{ error }`

### Solana Service (services/solana/)

#### config.ts
- Initializes `Connection` to SOLANA_RPC_URL
- Loads fee payer keypair from SOLANA_FEE_PAYER_PRIVATE_KEY
- Configures USDC mint address
- Exports configured constants

#### quote.ts
- Calculates SOL amount from USDC amount
- Fetches SOL price from Jupiter API or hardcoded rate
- Adds 2% service fee margin
- Returns quote with 30-second expiration

#### transaction-builder.ts
- Creates fee payer transaction for USDC → SOL swap
- Constructs transfer instruction: user → service wallet
- Service wallet pays transaction fee
- Returns base64-encoded transaction for user signature

#### submit.ts
- Accepts transactionId and signed transaction
- Broadcasts to Solana blockchain
- Polls for confirmation (max 30s)
- Updates database with txHash and status

### TRON Service (services/tron/)

#### config.ts
- Initializes TronWeb client to TRON_API_URL
- Loads service wallet private key (hex format)
- Configures USDT contract address
- Exports configured client

#### quote.ts
- Calculates TRX amount from USDT amount
- Fetches TRX price from CoinGecko or market data
- Adds 2-3% service + energy provider fees
- Returns quote with provider selection

#### transaction-builder.ts
- Creates unsigned USDT transfer transaction
- Recipient: service wallet
- User pays gas via energy delegation
- Returns hex-encoded transaction for signing

#### tx-decoder.ts
- Validates signed transaction structure
- Ensures recipient is service wallet
- Checks transaction is well-formed
- Prevents replay/manipulation attacks

#### commit-reveal.ts
- Implements secure 2-phase execution
- Phase 1: Client signs, server validates & stores in Redis (5min TTL)
- Phase 2: Server delegates energy, broadcasts signed tx
- Prevents loss of funds if execution fails

#### energy-providers/types.ts
- Defines EnergyProvider interface:
  ```typescript
  interface EnergyProvider {
    name: string;
    delegateEnergy(to: string, amount: number): Promise<void>;
    getEstimatedCost(): Promise<number>;
  }
  ```

#### energy-providers/index.ts - EnergyManager
- Manages provider array: [APITRX, Tronsave]
- `selectProvider()` - Chooses based on availability, cost
- `delegateEnergy()` - Attempts primary, falls back to secondary
- `getEstimatedFee()` - Returns cheapest available provider fee

#### energy-providers/apitrx.ts
- Calls APITRX API for energy delegation
- API Key from APITRX_API_KEY
- Returns transaction receipt
- ~2.5 TRX per transaction cost

#### energy-providers/tronsave.ts
- Fallback provider: Calls Tronsave API
- API Key from TRONSAVE_API_KEY
- Same interface as APITRX
- ~3.5 TRX per transaction cost

### Services - Shared

#### redis.ts
- Redis client initialization
- Key patterns:
  - `pending:tx:{transactionId}` - Pending TRON transactions
  - `rate-limit:{identifier}` - Rate limit counters
  - All keys: 5-minute TTL by default
- Methods: get, set, del, increment, expire

#### abuse-tracker.ts
- Monitors for suspicious patterns:
  - 3+ abandoned transactions (pending > 5 min)
  - Same wallet from 5+ different IPs in 24h
  - Rapid request spikes from single IP
- `trackUserActivity()` - Record user action
- `checkAbuseFlags()` - Query suspicious wallets
- `flagWallet()` - Mark wallet for manual review

## Frontend Structure

### Directory Layout

```
frontend/src/
├── main.tsx                   # App entry, wallet providers
├── App.tsx                    # Router (Home, Admin)
├── pages/
│   ├── Home.tsx              # TRON top-up UI
│   └── Admin.tsx             # Admin dashboard
├── components/
│   ├── ChainSelector.tsx     # Solana/TRON toggle
│   ├── NetworkSelector.tsx   # Network selection
│   ├── TokenSelector.tsx     # Stablecoin selector
│   ├── AmountInput.tsx       # Amount input with validation
│   ├── QuoteDisplay.tsx      # Display fees & native amount
│   ├── StatusIndicator.tsx   # TX status badge
│   ├── TopUpForm.tsx         # Full form composition
│   └── TransactionStatus.tsx # Status polling modal
├── hooks/
│   ├── useTronWallet.ts      # WalletConnect + TronLink
│   ├── useTronTransaction.ts # TRON transaction lifecycle
│   ├── use-tron-topup.ts     # Full TRON top-up flow
│   └── use-solana-topup.ts   # Solana top-up flow
├── services/
│   └── api.ts                # API client (solanaApi, tronApi)
└── index.css                 # Global styles
```

### Frontend Key Files

#### main.tsx - App Initialization
- React 18 + React Router 7
- Wallet provider setup:
  - Solana: `@solana/wallet-adapter-react`
  - TRON: `@tronweb3/tronwallet-adapter-react-hooks`
- Tailwind CSS initialization
- Error boundary setup

#### App.tsx - Router Configuration
- Route `/`: Home page (TRON focus)
- Route `/admin`: Admin dashboard
- Protected routes with API key auth

#### pages/Home.tsx - Main UI
- Input: stablecoin amount
- Displays: quote, fees, native amount
- Status tracking: pending → processing → confirmed
- Integrates TopUpForm component

#### pages/Admin.tsx - Admin Dashboard
- Requires admin API key in localStorage
- Displays: flagged wallets, incidents, stats
- Actions: blacklist/whitelist wallets
- Real-time refresh

#### components/TopUpForm.tsx - Form Composition
- Combines all input components
- Manages form state
- Calls `useTronTopup` or `useSolanaTopup` hook
- Error handling & validation feedback

#### hooks/useTronWallet.ts - Wallet Integration
- TronLink detection & connection
- WalletConnect for mobile wallets (TrustWallet, TronLink app)
- Balance polling
- Signature requests
- Export: `{ wallet, balance, sign, isConnected }`

#### hooks/useTronTransaction.ts - Transaction Lifecycle
- Build unsigned transaction
- Request user signature
- Submit signed transaction
- Poll transaction status
- Handle errors & retries
- Export: `{ buildTx, submitTx, getTxStatus, status }`

#### hooks/use-tron-topup.ts - Complete Flow Hook
- Chains: quote → buildTx → sign → submit → track
- Manages all state & UI updates
- Handles provider selection
- Error recovery
- Export: `{ topup, status, error, quote }`

#### services/api.ts - API Client
- Axios instance with backend URL
- Methods: `getQuote()`, `buildTx()`, `submit()`, `getTxStatus()`
- Chains: solanaApi.* and tronApi.*
- Error handling & retry logic

### Component Patterns

**Reusable Input Components:**
- Props: value, onChange, error, disabled, label
- TailwindCSS styling: consistent spacing, colors
- Accessibility: htmlFor, ARIA labels
- Responsive: mobile-first design

**Status Components:**
- Indicator badge: pending (yellow), processing (blue), confirmed (green), failed (red)
- Icon + text
- Optional spinner animation

## Shared Package

### types/index.ts - Type Definitions

**Core Types:**
- `Chain = 'solana' | 'tron'`
- `TxType = 'topup' | 'send'`
- `TxStatus = 'pending' | 'processing' | 'completed' | 'failed'`

**Request/Response Types:**
- `Quote` - Fee estimate
- `TopUpRequest` - User input
- `TopUpResponse` - Transaction ID + unsigned TX
- `SubmitResponse` - Confirmed hash or error
- `Transaction` - Full transaction record

**Usage:**
```typescript
import type { Chain, Quote, Transaction } from '@gas-station/shared';
```

## Code Standards

### TypeScript

**Strict Mode:**
- Enable: `strict: true` in tsconfig.json
- No implicit any
- No null/undefined without checking

**Naming Conventions:**
- Files: kebab-case (e.g., error-handler.ts)
- Classes/Types: PascalCase (EnergyManager, AppError)
- Functions/Variables: camelCase (getQuote, maxTransactionAmount)
- Constants: UPPER_SNAKE_CASE (MAX_TX_AMOUNT_USD)
- Interfaces: Prefix with `I` or no prefix, PascalCase

**Imports:**
- ESM format: `import x from 'y.js'` (explicit .js extension in Node ESM)
- Wildcard: `import * as x from 'y.js'`
- Type imports: `import type { X } from 'y.js'`

### Validation

**Request Validation:**
- Use Zod schemas for all input
- Validate body, query, params
- Return 400 with validation errors
- Example:
```typescript
const quoteSchema = z.object({
  stablecoinAmount: z.string().refine(x => !isNaN(parseFloat(x)))
});

router.post('/quote', validate(quoteSchema), handler);
```

### Error Handling

**HTTP Responses:**
- Success (2xx): Include data
- Client Error (4xx): Include error message + code
- Server Error (5xx): Generic message, log details

**Custom Errors:**
```typescript
throw new AppError(400, 'Invalid amount', 'INVALID_AMOUNT');
```

### Database

**Query Patterns:**
- Parameterized queries (prevent SQL injection)
- Connection pooling via pg.Pool
- Transactions for multi-statement operations
- Indexes on WHERE, JOIN, ORDER BY columns

**Naming:**
- Tables: snake_case, plural (transactions, user_stats)
- Columns: snake_case (user_address, created_at)
- Constraints: Explicit names or auto-generated

### Testing

**Unit Tests:**
- Location: `src/__tests__/*.test.ts`
- Framework: Jest (via Node.js)
- Coverage target: 80%+ for services
- Patterns: mock external dependencies (Redis, DB, RPC)

**Example:**
```typescript
describe('abuseTracker', () => {
  it('should flag wallet after 3 abandons', async () => {
    // arrange
    const wallet = 'test_wallet';

    // act
    await flagAbandons(wallet, 3);

    // assert
    const flags = await getFlags(wallet);
    expect(flags.flagged).toBe(true);
  });
});
```

### Git & Versioning

**Commit Messages:**
- Format: `[backend|frontend|shared] feat|fix|chore: description`
- Example: `[backend] feat: add TRON commit-reveal flow`

**Branches:**
- Feature: `feature/short-description`
- Bugfix: `bugfix/issue-name`
- Hotfix: `hotfix/critical-issue`

**Tags:**
- Format: `v{major}.{minor}.{patch}`
- Semantic versioning

## Build & Deployment

### Build Process

```bash
# Root workspace
npm run build       # Builds all packages in order
npm run build:shared
npm run build:backend
npm run build:frontend

# Output:
# backend/dist/    - JavaScript files
# frontend/dist/   - Static HTML+CSS+JS
# shared/dist/     - .d.ts and .js types
```

**TypeScript Compilation:**
- backend: ESM with Node.js resolution
- frontend: ESM with browser resolution
- shared: ESM for both
- Source maps included for debugging

### Development

```bash
npm run dev       # Runs backend + frontend concurrently

# Individual:
npm run dev -w backend    # Port 3001, auto-reload
npm run dev -w frontend   # Port 5173 (Vite), hot reload
```

### Type Checking

```bash
npm run typecheck   # Check all packages without emitting
```

### Production

**Backend (Railway):**
- Uses Dockerfile
- Runs: `npm run start -w backend`
- Loads environment from Railway dashboard
- Port 3001 exposed

**Frontend (Vercel):**
- Uses vercel.json config
- Static build via `npm run build -w frontend`
- Served via Vercel CDN
- CORS to backend via .env.local

## Configuration Files

### tsconfig.base.json
- Base config for all packages
- `strict: true`, `esModuleInterop: true`
- Target: ES2020
- Module: ESNext

### backend/tsconfig.json
- Extends base
- Module: ESNext
- Lib: ES2020
- Target: ES2020
- Resolves 3rd-party packages

### frontend/vite.config.ts
- React plugin enabled
- Path aliases: `@/` = `src/`
- Build: minified, source maps for prod
- Dev: HMR on localhost:5173

### vercel.json
- Framework: React
- Build command: `npm run build -w frontend`
- Output directory: `frontend/dist`

---

**Document Version:** 1.0
**Last Updated:** 2026-01-03
**Status:** Active (MVP Phase)
