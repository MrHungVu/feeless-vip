---
parent: ./plan.md
phase: 5
status: pending
effort: 3h
depends_on: [phase-03, phase-04]
---

# Phase 5: Frontend Redesign

## Overview

Redesign the frontend with simple form UI focused on TRON USDT → TRX conversion. Support Ledger/TrustWallet via WalletConnect.

## Dependencies

- Phase 3: Commit-reveal endpoints
- Phase 4: WalletConnect hooks

## UI Design

```
┌──────────────────────────────────────────────────────────┐
│                     ⛽ Gas Station                        │
│              Get TRX without paying gas fees              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Network     [TRON ▼]         [Solana - Coming Soon]     │
│                                                          │
│  Token       [USDT ▼]                                    │
│                                                          │
│  Amount      [____________] USDT        [MAX]            │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  You pay:         10.50 USDT                             │
│  You receive:     ~58.5 TRX                              │
│  Service fee:     0.50 USDT                              │
│  Network fee:     Covered ✓                              │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │        🔗 Connect Wallet                         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │        Send USDT →                               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│  Status: Ready                                           │
│                                                          │
│  Supported: TronLink, TrustWallet, Ledger                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## New Components

### `frontend/src/components/NetworkSelector.tsx`

```typescript
interface NetworkOption {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

const NETWORKS: NetworkOption[] = [
  { id: 'tron', name: 'TRON', icon: '🔴', enabled: true },
  { id: 'solana', name: 'Solana', icon: '🟣', enabled: false }
];

export function NetworkSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {NETWORKS.map(net => (
        <button
          key={net.id}
          onClick={() => net.enabled && onChange(net.id)}
          disabled={!net.enabled}
          className={`
            px-4 py-2 rounded-lg border
            ${value === net.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}
            ${!net.enabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}
          `}
        >
          {net.icon} {net.name}
          {!net.enabled && <span className="text-xs ml-1">(Soon)</span>}
        </button>
      ))}
    </div>
  );
}
```

### `frontend/src/components/TokenSelector.tsx`

```typescript
const TOKENS = [
  { id: 'usdt', name: 'USDT', icon: '💵' },
  { id: 'usdc', name: 'USDC', icon: '💲', disabled: true }
];

export function TokenSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2"
    >
      {TOKENS.map(t => (
        <option key={t.id} value={t.id} disabled={t.disabled}>
          {t.icon} {t.name} {t.disabled && '(Soon)'}
        </option>
      ))}
    </select>
  );
}
```

### `frontend/src/components/AmountInput.tsx`

```typescript
interface Props {
  value: string;
  onChange: (v: string) => void;
  maxAmount?: string;
  token: string;
}

export function AmountInput({ value, onChange, maxAmount, token }: Props) {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0.00"
        min="0"
        step="0.01"
        className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 flex-1"
      />
      <span className="text-gray-400">{token.toUpperCase()}</span>
      {maxAmount && (
        <button
          onClick={() => onChange(maxAmount)}
          className="text-blue-400 text-sm hover:underline"
        >
          MAX
        </button>
      )}
    </div>
  );
}
```

### `frontend/src/components/QuoteDisplay.tsx`

```typescript
interface Quote {
  youPay: string;
  youReceive: string;
  serviceFee: string;
  networkFee: string;
}

export function QuoteDisplay({ quote }: { quote: Quote | null }) {
  if (!quote) return null;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
      <div className="flex justify-between">
        <span className="text-gray-400">You pay:</span>
        <span>{quote.youPay} USDT</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">You receive:</span>
        <span className="text-green-400">~{quote.youReceive} TRX</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Service fee:</span>
        <span className="text-gray-400">{quote.serviceFee} USDT</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Network fee:</span>
        <span className="text-green-400">Covered ✓</span>
      </div>
    </div>
  );
}
```

### `frontend/src/components/StatusIndicator.tsx`

```typescript
type Status = 'idle' | 'connecting' | 'signing' | 'processing' | 'success' | 'error';

const STATUS_CONFIG: Record<Status, { text: string; color: string }> = {
  idle: { text: 'Ready', color: 'text-gray-400' },
  connecting: { text: 'Connecting wallet...', color: 'text-yellow-400' },
  signing: { text: 'Please sign in your wallet...', color: 'text-yellow-400' },
  processing: { text: 'Processing transaction...', color: 'text-blue-400' },
  success: { text: 'Transaction complete!', color: 'text-green-400' },
  error: { text: 'Error occurred', color: 'text-red-400' }
};

export function StatusIndicator({
  status,
  message,
  txHash
}: {
  status: Status;
  message?: string;
  txHash?: string;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={`text-sm ${config.color}`}>
      <span>{message || config.text}</span>
      {txHash && (
        <a
          href={`https://tronscan.org/#/transaction/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 underline"
        >
          View tx
        </a>
      )}
    </div>
  );
}
```

## Redesigned Page

### `frontend/src/pages/Home.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useTronWallet } from '../hooks/useTronWallet';
import { buildUsdtTransfer, getUsdtBalance } from '../hooks/useTronTransaction';
import { NetworkSelector } from '../components/NetworkSelector';
import { TokenSelector } from '../components/TokenSelector';
import { AmountInput } from '../components/AmountInput';
import { QuoteDisplay } from '../components/QuoteDisplay';
import { StatusIndicator } from '../components/StatusIndicator';
import { api } from '../services/api';

type FlowStatus = 'idle' | 'connecting' | 'signing' | 'processing' | 'success' | 'error';

export function Home() {
  const { address, isConnected, isConnecting, walletName, connect, disconnect, signTransaction } = useTronWallet();

  const [network, setNetwork] = useState('tron');
  const [token, setToken] = useState('usdt');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [status, setStatus] = useState<FlowStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Fetch balance when connected
  useEffect(() => {
    if (address) {
      getUsdtBalance(address).then(setBalance);
    }
  }, [address]);

  // Fetch quote when amount changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0 && address) {
      api.getTronQuote({ userAddress: address, usdtAmount: amount })
        .then(setQuote)
        .catch(() => setQuote(null));
    } else {
      setQuote(null);
    }
  }, [amount, address]);

  const handleConnect = async () => {
    setStatus('connecting');
    setError(null);
    try {
      await connect();
      setStatus('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
      setStatus('error');
    }
  };

  const handleSend = async () => {
    if (!address || !quote) return;

    try {
      // 1. Build transaction
      setStatus('signing');
      const tx = await buildUsdtTransfer({
        fromAddress: address,
        amount: quote.totalUsdtCharged
      });

      // 2. Sign with wallet
      const signedTx = await signTransaction(tx);

      // 3. Commit to backend
      setStatus('processing');
      const { commitId } = await api.commitTransaction({
        signedTx,
        quoteId: quote.quoteId,
        expectedAmount: quote.totalUsdtCharged,
        userAddress: address
      });

      // 4. Execute
      const result = await api.executeTransaction({ commitId });

      if (result.success) {
        setTxHash(result.usdtTxHash);
        setStatus('success');
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">⛽ Gas Station</h1>
          <p className="text-gray-400 text-sm">Get TRX without paying gas fees</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Network</label>
            <NetworkSelector value={network} onChange={setNetwork} />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Token</label>
            <TokenSelector value={token} onChange={setToken} />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Amount</label>
            <AmountInput
              value={amount}
              onChange={setAmount}
              maxAmount={balance || undefined}
              token={token}
            />
            {balance && (
              <p className="text-xs text-gray-500 mt-1">Balance: {balance} USDT</p>
            )}
          </div>
        </div>

        <QuoteDisplay quote={quote ? {
          youPay: quote.totalUsdtCharged,
          youReceive: quote.trxAmount,
          serviceFee: quote.serviceFee,
          networkFee: 'Covered'
        } : null} />

        <div className="space-y-3">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : '🔗 Connect Wallet'}
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  {walletName}: {address?.slice(0, 8)}...{address?.slice(-6)}
                </span>
                <button onClick={disconnect} className="text-red-400 hover:underline">
                  Disconnect
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={!quote || status !== 'idle'}
                className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-medium disabled:opacity-50"
              >
                Send USDT →
              </button>
            </>
          )}
        </div>

        <StatusIndicator
          status={status}
          message={error || undefined}
          txHash={txHash || undefined}
        />

        <p className="text-xs text-gray-500 text-center">
          Supported: TronLink, TrustWallet, Ledger
        </p>
      </div>
    </div>
  );
}
```

## API Service Update

### `frontend/src/services/api.ts`

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = {
  async getTronQuote(params: { userAddress: string; usdtAmount: string }) {
    const res = await fetch(`${API_URL}/api/tron/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Quote failed');
    return res.json();
  },

  async commitTransaction(params: {
    signedTx: any;
    quoteId: string;
    expectedAmount: string;
    userAddress: string;
  }) {
    const res = await fetch(`${API_URL}/api/tron/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Commit failed');
    }
    return res.json();
  },

  async executeTransaction(params: { commitId: string }) {
    const res = await fetch(`${API_URL}/api/tron/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Execute failed');
    }
    return res.json();
  }
};
```

## Implementation Steps

- [ ] Create NetworkSelector component
- [ ] Create TokenSelector component
- [ ] Create AmountInput component
- [ ] Create QuoteDisplay component
- [ ] Create StatusIndicator component
- [ ] Update api.ts with new endpoints
- [ ] Redesign Home.tsx with full flow
- [ ] Test full flow: connect → quote → sign → commit → execute
- [ ] Add loading states and error handling
- [ ] Mobile responsive testing

## Success Criteria

- [ ] User can select TRON network (Solana disabled)
- [ ] User can enter USDT amount
- [ ] Quote updates live as amount changes
- [ ] WalletConnect modal opens on connect
- [ ] TrustWallet can connect and sign
- [ ] Full flow works: sign → commit → execute → TRX received
- [ ] Clear status indicators throughout flow
- [ ] Error messages are user-friendly
- [ ] Works on mobile browsers
