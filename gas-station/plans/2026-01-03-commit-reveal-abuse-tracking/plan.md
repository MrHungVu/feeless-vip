---
title: "Commit-Reveal Pattern + Abuse Tracking + WalletConnect"
description: "Secure Gas Station with user-first signing, abuse tracking, and Ledger/TrustWallet support"
status: pending
priority: P1
effort: 18h
branch: main
tags: [security, tron, walletconnect, abuse-prevention]
created: 2026-01-03
---

# Gas Station Refactor: Commit-Reveal + Abuse Tracking

## Problem Statement

Current flow delegates energy BEFORE user signs transaction. If user abandons after energy delegation, service loses ~2.5 TRX per incident. Need secure commit-reveal pattern where user signs first, then we delegate energy and broadcast.

## Solution Overview

1. **Commit-Reveal Pattern**: User signs tx → we validate → delegate energy → broadcast
2. **Abuse Tracking**: Track user/IP behavior, flag suspicious patterns for review
3. **WalletConnect Frontend**: Support Ledger/TrustWallet via WalletConnect v2

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ WalletConnect│───▶│ Build Tx   │───▶│ Sign & Submit       │  │
│  │ (TrustWallet)│    │ (TronWeb)  │    │ /api/tron/commit    │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ /commit     │───▶│ Validate   │───▶│ Store in Redis      │  │
│  │             │    │ Signature  │    │ (5 min TTL)         │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                                                │                │
│  ┌─────────────┐    ┌─────────────┐           ▼                │
│  │ /execute    │───▶│ Delegate   │───▶│ Broadcast + Send TRX │  │
│  │             │    │ Energy     │    │                       │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   ABUSE TRACKER                             ││
│  │  - Track requests/completions/abandonments per wallet/IP    ││
│  │  - Flag suspicious patterns for manual review               ││
│  │  - Store in PostgreSQL                                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| [Phase 1](./phase-01-redis-setup.md) | Redis setup + pending tx storage | 2h | pending |
| [Phase 2](./phase-02-abuse-tracking.md) | Abuse tracking system | 3h | pending |
| [Phase 3](./phase-03-commit-reveal.md) | Commit-reveal API endpoints | 4h | pending |
| [Phase 4](./phase-04-walletconnect.md) | WalletConnect integration | 4h | pending |
| [Phase 5](./phase-05-frontend.md) | Frontend redesign | 3h | pending |
| [Phase 6](./phase-06-admin.md) | Admin dashboard | 2h | pending |

## Key Decisions

1. **TronLink Adapter + WalletConnect** - Unified wallet modal supporting:
   - TronLink browser extension (desktop)
   - TronLink mobile app (via WalletConnect)
   - TrustWallet mobile (via WalletConnect)
   - Ledger (via TronLink USB/Bluetooth)
2. **Flag for review, not auto-blacklist** - Manual review before blocking users
3. **Redis for pending tx (5 min TTL)** - Fast access, auto-expiry
4. **PostgreSQL for audit trail** - Permanent record of all transactions

## Research Reports

- [WalletConnect TRON Integration](./research/researcher-01-walletconnect-tron.md)
- [TRON Transaction Decoding](./research/researcher-02-tron-tx-decoding.md)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| User signs invalid tx | Low | Validate signature + decode tx before accepting |
| Redis failure | Medium | Fallback to PostgreSQL for pending tx |
| WalletConnect relay timeout | Medium | Retry logic with exponential backoff |
| Abuse detection false positives | Low | Manual review before blocking |

## Success Criteria

- [ ] Zero energy loss from abandoned transactions
- [ ] All signed transactions validated before energy delegation
- [ ] Abuse patterns flagged for review
- [ ] Ledger/TrustWallet users can complete transactions
- [ ] Admin dashboard shows flagged users and incidents
