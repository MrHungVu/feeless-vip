# Gas Station MVP

Web service enabling stablecoin holders (USDC/USDT) to get native tokens (SOL/TRX) without gas via fee payer pattern.

## Features

- **Solana Top-Up**: Pay USDC, receive SOL (fee payer pattern)
- **TRON Top-Up**: Pay USDT, receive TRX (energy delegation)
- **Multi-Provider Energy**: APITRX (primary) + Tronsave (fallback) + extensible
- **Wallet Integration**: Phantom, Solflare (Solana) + TronLink (TRON)
- **Rate Limiting**: 10 tx/min per IP
- **Transaction Logging**: Full audit trail in PostgreSQL

## Architecture

```
User Wallet -> Frontend (React) -> Backend (Express) -> Blockchain RPCs
                                         |
                                    PostgreSQL
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript + PostgreSQL
- **Wallets**: @solana/wallet-adapter-react, @tronweb3/tronwallet-adapter-react-hooks
- **SDKs**: @solana/web3.js, @solana/spl-token, tronweb

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm 9+

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run migrate

# Start development servers
npm run dev
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/gasstation

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_FEE_PAYER_PRIVATE_KEY=<base58-encoded-private-key>
USDC_MINT_SOLANA=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# TRON
TRON_API_URL=https://api.trongrid.io
TRON_PRIVATE_KEY=<hex-private-key>
USDT_CONTRACT_TRON=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

# TRON Energy Providers (at least one required)
APITRX_API_KEY=<from-telegram-bot>      # Primary - get from Telegram bot
TRONSAVE_API_KEY=<from-tronsave.io>     # Fallback - get from tronsave.io

# App
PORT=3001
FRONTEND_URL=http://localhost:5173
MAX_TX_AMOUNT_USD=500
RATE_LIMIT_PER_MIN=10
```

## TRON Energy Providers

The system supports multiple energy providers with automatic fallback:

| Provider | Get API Key | Pricing |
|----------|-------------|---------|
| **APITRX** (Primary) | [Telegram Bot](https://apitrx.com/en/pages/api) | ~2.5 TRX/tx |
| **Tronsave** (Fallback) | [tronsave.io](https://tronsave.io) | ~3.5 TRX/tx |

### Adding New Providers

Create a new provider in `backend/src/services/tron/energy-providers/`:

```typescript
// my-provider.ts
import type { EnergyProvider } from './types.js';

export class MyProvider implements EnergyProvider {
  name = 'my-provider';
  // ... implement interface methods
}
```

Then register in `energy-providers/index.ts`.

## Project Structure

```
gas-station/
├── frontend/           # React Vite app
│   └── src/
│       ├── components/ # UI components
│       ├── hooks/      # Custom hooks
│       ├── services/   # API client
│       └── pages/      # Page components
├── backend/            # Express API
│   └── src/
│       ├── routes/     # API routes
│       ├── services/   # Business logic
│       │   ├── solana/ # Solana integration
│       │   └── tron/   # TRON integration
│       ├── db/         # Database layer
│       └── middleware/ # Express middleware
└── shared/             # Shared types
```

## API Endpoints

### Solana
- `POST /api/solana/quote` - Get fee estimate
- `POST /api/solana/build-tx` - Build transaction for user to sign
- `POST /api/solana/submit` - Submit signed transaction
- `GET /api/solana/tx/:id` - Get transaction status

### TRON
- `GET /api/tron/providers` - List available energy providers
- `POST /api/tron/quote` - Get fee estimate (optional: `preferredProvider`)
- `POST /api/tron/build-tx` - Build transaction (optional: `preferredProvider`)
- `POST /api/tron/commit` - Store signed TX for 2-phase execution
- `POST /api/tron/execute` - Execute committed TX with delegated energy
- `POST /api/tron/submit` - Submit signed transaction
- `GET /api/tron/tx/:id` - Get transaction status

### Admin (requires `x-admin-key` header)
- `GET /api/admin/stats` - Transaction statistics
- `GET /api/admin/flagged` - List flagged wallets
- `GET /api/admin/blacklisted` - List blacklisted wallets
- `GET /api/admin/incidents` - View abuse incidents
- `POST /api/admin/users/:wallet/flag` - Flag a wallet
- `POST /api/admin/users/:wallet/blacklist` - Blacklist wallet
- `POST /api/admin/users/:wallet/whitelist` - Remove flag/blacklist

### Health
- `GET /health` - Service health check

## Deployment

### Backend (Railway)

```bash
# Uses Dockerfile
railway up
```

### Frontend (Vercel)

```bash
# Uses vercel.json
vercel deploy
```

## Security

- Private keys stored in environment variables (upgrade to KMS for production)
- Rate limiting: 10 tx/min per IP
- Transaction caps: $500 max per tx
- All transactions logged with audit trail
- Abuse detection: Multi-IP monitoring, abandoned TX tracking

## Documentation

See `docs/` directory for detailed documentation:

- **[project-overview-pdr.md](docs/project-overview-pdr.md)** - Features, requirements, API contract
- **[code-standards.md](docs/code-standards.md)** - Architecture, code patterns, standards
- **[system-architecture.md](docs/system-architecture.md)** - Diagrams, data flows, scaling
- **[codebase-summary.md](docs/codebase-summary.md)** - Codebase overview, metrics

## Development Commands

```bash
npm run dev              # Start backend (3001) + frontend (5173)
npm run build           # Build all packages
npm run typecheck       # Type check without building
npm run migrate         # Run database migrations
npm run dev -w backend  # Backend only
npm run dev -w frontend # Frontend only
```

## License

MIT
