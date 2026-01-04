---
parent: ./plan.md
phase: 3
status: pending
effort: 4h
depends_on: [phase-01, phase-02]
---

# Phase 3: Commit-Reveal API Endpoints

## Overview

Implement the secure commit-reveal flow:
1. `/api/tron/commit` - Receive signed tx, validate, store in Redis
2. `/api/tron/execute` - Delegate energy, broadcast, send TRX

## Dependencies

- Phase 1: Redis setup
- Phase 2: Abuse tracking

## Flow Diagram

```
User signs tx → POST /commit → Validate → Store Redis → Return commitId
                                             │
User confirms → POST /execute ← Get from Redis ← commitId
                     │
                     ▼
              Delegate Energy (APITRX)
                     │
                     ▼
              Broadcast signed tx
                     │
                     ▼
              Send TRX to user
                     │
                     ▼
              Track completion
```

## New Files

### `backend/src/services/tron/tx-decoder.ts`

```typescript
import { TronWeb } from 'tronweb';

const TRANSFER_SELECTOR = 'a9059cbb';

interface DecodedTx {
  sender: string;
  recipient: string;
  amount: bigint;
  contractAddress: string;
  isValid: boolean;
  error?: string;
}

export function decodeSignedTx(signedTx: any, tronWeb: TronWeb): DecodedTx {
  try {
    const contract = signedTx.raw_data?.contract?.[0];
    if (!contract) {
      return { isValid: false, error: 'No contract in transaction' } as DecodedTx;
    }

    const { parameter } = contract;
    const { owner_address, contract_address, data } = parameter.value;

    // Decode sender
    const sender = tronWeb.address.fromHex(owner_address);

    // Check if TRC20 transfer
    if (!data || !data.startsWith(TRANSFER_SELECTOR)) {
      return { isValid: false, error: 'Not a TRC20 transfer' } as DecodedTx;
    }

    // Decode recipient (bytes 4-36, padded)
    const recipientHex = '41' + data.substring(32, 72);
    const recipient = tronWeb.address.fromHex(recipientHex);

    // Decode amount (bytes 36-68)
    const amountHex = data.substring(72, 136);
    const amount = BigInt('0x' + amountHex);

    // Get contract address
    const contractAddr = tronWeb.address.fromHex(contract_address);

    return {
      sender,
      recipient,
      amount,
      contractAddress: contractAddr,
      isValid: true
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Decode error: ${(error as Error).message}`
    } as DecodedTx;
  }
}

export function validateSignature(signedTx: any): boolean {
  // Check signature exists
  if (!signedTx.signature || signedTx.signature.length === 0) {
    return false;
  }
  // Signature should be 65 bytes (130 hex chars)
  return signedTx.signature[0].length === 130;
}

export function isExpired(signedTx: any): boolean {
  const expiration = signedTx.raw_data?.expiration;
  if (!expiration) return true;
  return Date.now() > expiration;
}
```

### `backend/src/services/tron/commit-reveal.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { tronWeb, USDT_CONTRACT, USDT_DECIMALS } from './config.js';
import { decodeSignedTx, validateSignature, isExpired } from './tx-decoder.js';
import { storePendingTx, getPendingTx, deletePendingTx } from '../redis.js';
import { getEnergyManager } from './energy-providers/index.js';
import { trackRequest, trackCompletion, isBlacklisted } from '../abuse-tracker.js';
import { createTransaction, updateTransactionStatus } from '../../db/transactions.js';
import { ENERGY_USDT_WITH_BALANCE } from './config.js';

const SERVICE_WALLET = process.env.SERVICE_WALLET_TRON!;

interface CommitRequest {
  signedTx: any;
  quoteId: string;
  expectedAmount: string;
  userAddress: string;
  ipAddress: string;
}

interface CommitResponse {
  commitId: string;
  expiresAt: number;
}

export async function commitTransaction(req: CommitRequest): Promise<CommitResponse> {
  const { signedTx, quoteId, expectedAmount, userAddress, ipAddress } = req;

  // 1. Check blacklist
  if (await isBlacklisted(userAddress, ipAddress)) {
    throw new Error('User is blacklisted');
  }

  // 2. Validate signature exists
  if (!validateSignature(signedTx)) {
    throw new Error('Invalid signature');
  }

  // 3. Check expiration
  if (isExpired(signedTx)) {
    throw new Error('Transaction expired');
  }

  // 4. Decode transaction
  const decoded = decodeSignedTx(signedTx, tronWeb);
  if (!decoded.isValid) {
    throw new Error(decoded.error || 'Invalid transaction');
  }

  // 5. Validate destination is our service wallet
  if (decoded.recipient !== SERVICE_WALLET) {
    throw new Error('Invalid recipient address');
  }

  // 6. Validate contract is USDT
  if (decoded.contractAddress !== USDT_CONTRACT) {
    throw new Error('Invalid token contract');
  }

  // 7. Validate amount matches quote
  const expectedAmountBigInt = BigInt(
    Math.floor(parseFloat(expectedAmount) * 10 ** USDT_DECIMALS)
  );
  if (decoded.amount !== expectedAmountBigInt) {
    throw new Error('Amount mismatch');
  }

  // 8. Check user USDT balance
  const balance = await getUsdtBalance(userAddress);
  if (balance < decoded.amount) {
    throw new Error('Insufficient USDT balance');
  }

  // 9. Track request
  await trackRequest(userAddress, ipAddress);

  // 10. Store in Redis
  const commitId = uuidv4();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  await storePendingTx(commitId, {
    signedTx,
    quoteId,
    userAddress,
    ipAddress,
    usdtAmount: expectedAmount,
    trxAmount: '0', // Will be calculated on execute
    createdAt: Date.now()
  });

  return { commitId, expiresAt };
}

export async function executeTransaction(commitId: string): Promise<{
  success: boolean;
  usdtTxHash?: string;
  trxTxHash?: string;
  error?: string;
}> {
  // 1. Get pending tx from Redis
  const pending = await getPendingTx(commitId);
  if (!pending) {
    throw new Error('Commit not found or expired');
  }

  const { signedTx, userAddress, ipAddress, usdtAmount } = pending;

  try {
    // 2. Create DB record
    const txId = await createTransaction({
      chain: 'tron',
      txType: 'topup',
      userAddress,
      stablecoinAmount: usdtAmount,
      nativeAmount: '0',
      feeCharged: '0.5'
    });

    await updateTransactionStatus(txId, 'processing');

    // 3. Delegate energy
    const energyManager = getEnergyManager();
    await energyManager.delegateEnergy(userAddress, ENERGY_USDT_WITH_BALANCE);

    // 4. Broadcast signed transaction
    const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
    if (!broadcast.result) {
      throw new Error('Broadcast failed: ' + JSON.stringify(broadcast));
    }
    const usdtTxHash = broadcast.txid;

    // 5. Wait for confirmation (simple poll)
    await waitForConfirmation(usdtTxHash);

    // 6. Calculate TRX to send (based on quote)
    const trxAmount = calculateTrxAmount(usdtAmount);

    // 7. Send TRX to user
    const trxTx = await tronWeb.trx.sendTransaction(
      userAddress,
      Math.floor(parseFloat(trxAmount) * 1e6)
    );
    const trxTxHash = trxTx.txid;

    // 8. Track completion
    await trackCompletion(userAddress);

    // 9. Update DB
    await updateTransactionStatus(txId, 'completed', usdtTxHash);

    // 10. Delete from Redis
    await deletePendingTx(commitId);

    return { success: true, usdtTxHash, trxTxHash };
  } catch (error) {
    // Don't track abandonment here - only on expiry
    throw error;
  }
}

async function getUsdtBalance(address: string): Promise<bigint> {
  const contract = await tronWeb.contract().at(USDT_CONTRACT);
  const balance = await contract.balanceOf(address).call();
  return BigInt(balance.toString());
}

async function waitForConfirmation(txHash: string, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const info = await tronWeb.trx.getTransactionInfo(txHash);
    if (info && info.receipt) {
      if (info.receipt.result === 'SUCCESS') return;
      throw new Error('Transaction failed on-chain');
    }
  }
  throw new Error('Confirmation timeout');
}

function calculateTrxAmount(usdtAmount: string): string {
  // Simplified calculation - should use actual quote
  const usdt = parseFloat(usdtAmount);
  const trxPerUsdt = 6; // ~$0.25/TRX, 1 USDT = ~4 TRX after fees
  return (usdt * trxPerUsdt * 0.9).toFixed(6); // 10% fee
}
```

## Modified Files

### `backend/src/routes/tron.ts`

Add new endpoints:

```typescript
// POST /api/tron/commit
tronRoutes.post('/commit', validate(commitSchema), async (req, res, next) => {
  try {
    const result = await commitTransaction({
      signedTx: req.body.signedTx,
      quoteId: req.body.quoteId,
      expectedAmount: req.body.expectedAmount,
      userAddress: req.body.userAddress,
      ipAddress: req.ip || 'unknown'
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/tron/execute
tronRoutes.post('/execute', validate(executeSchema), async (req, res, next) => {
  try {
    const result = await executeTransaction(req.body.commitId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

### `.env.example`

Add:
```bash
SERVICE_WALLET_TRON=TYourServiceWalletAddressHere
```

## Validation Schemas

```typescript
const commitSchema = z.object({
  signedTx: z.any(),
  quoteId: z.string().uuid(),
  expectedAmount: z.string(),
  userAddress: z.string().regex(/^T[A-Za-z0-9]{33}$/)
});

const executeSchema = z.object({
  commitId: z.string().uuid()
});
```

## Background Job: Abandonment Tracking

Add to `backend/src/index.ts`:

```typescript
import { listPendingTxIds, getPendingTx, deletePendingTx } from './services/redis.js';
import { trackAbandonment } from './services/abuse-tracker.js';

// Check for expired commits every minute
setInterval(async () => {
  try {
    const ids = await listPendingTxIds();
    for (const id of ids) {
      const pending = await getPendingTx(id);
      if (!pending) {
        // Already expired by Redis TTL, but we lost the data
        continue;
      }
      // Redis TTL handles expiry, this is just for tracking
      // In production, use Redis keyspace notifications
    }
  } catch (error) {
    console.error('Abandonment check error:', error);
  }
}, 60000);
```

## Implementation Steps

- [ ] Create `backend/src/services/tron/tx-decoder.ts`
- [ ] Create `backend/src/services/tron/commit-reveal.ts`
- [ ] Add SERVICE_WALLET_TRON to .env
- [ ] Add commit/execute endpoints to tron.ts
- [ ] Add validation schemas
- [ ] Add abandonment tracking interval
- [ ] Test full flow: commit → execute → TRX received

## Success Criteria

- [ ] Signed tx validated before storing
- [ ] Invalid signatures rejected
- [ ] Wrong recipient/amount rejected
- [ ] Insufficient balance rejected
- [ ] Blacklisted users rejected
- [ ] Energy delegated only after validation
- [ ] USDT tx broadcasts successfully
- [ ] TRX sent to user after confirmation
- [ ] Completion tracked in abuse system
