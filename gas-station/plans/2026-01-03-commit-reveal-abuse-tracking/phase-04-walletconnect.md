---
parent: ./plan.md
phase: 4
status: pending
effort: 4h
depends_on: []
---

# Phase 4: Wallet Integration (TronLink + WalletConnect)

## Overview

Support multiple wallet connection methods:
1. **TronLink** (Primary) - Browser extension + Mobile app + Ledger support
2. **WalletConnect** (Secondary) - TrustWallet, TokenPocket, other WC-compatible wallets

## Supported Wallets

| Wallet | Platform | Ledger Support | Connection Method |
|--------|----------|----------------|-------------------|
| TronLink | Browser extension | ✅ USB | TronLink Adapter |
| TronLink | Mobile app | ✅ Bluetooth (Nano X) | WalletConnect |
| TrustWallet | Mobile app | ❌ | WalletConnect |
| TokenPocket | Mobile app | ❌ | WalletConnect |

## Dependencies

- WalletConnect Project ID from cloud.walletconnect.com
- TronLink Adapter for browser extension

## New Dependencies

```json
{
  "@tronweb3/tronwallet-adapter-react-hooks": "^1.1.0",
  "@tronweb3/tronwallet-adapter-react-ui": "^1.1.0",
  "@tronweb3/tronwallet-adapters": "^1.1.0",
  "@tronweb3/tronwallet-adapter-tronlink": "^1.1.0",
  "@tronweb3/tronwallet-adapter-walletconnect": "^1.1.0",
  "tronweb": "^6.0.0"
}
```

## New Files

### `frontend/src/providers/WalletProvider.tsx`

```typescript
import { useMemo } from 'react';
import { WalletProvider as TronWalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { WalletModalProvider } from '@tronweb3/tronwallet-adapter-react-ui';
import { TronLinkAdapter, WalletConnectAdapter } from '@tronweb3/tronwallet-adapters';

import '@tronweb3/tronwallet-adapter-react-ui/style.css';

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const adapters = useMemo(() => {
    const tronLink = new TronLinkAdapter();
    const walletConnect = new WalletConnectAdapter({
      network: 'Mainnet',
      options: {
        relayUrl: 'wss://relay.walletconnect.com',
        projectId: PROJECT_ID,
        metadata: {
          name: 'Gas Station',
          description: 'Get TRX without gas fees',
          url: window.location.origin,
          icons: [`${window.location.origin}/logo.png`]
        }
      }
    });
    return [tronLink, walletConnect];
  }, []);

  return (
    <TronWalletProvider adapters={adapters} autoConnect>
      <WalletModalProvider>
        {children}
      </WalletModalProvider>
    </TronWalletProvider>
  );
}
```

### `frontend/src/hooks/useTronWallet.ts`

```typescript
import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useWalletModal } from '@tronweb3/tronwallet-adapter-react-ui';

export function useTronWallet() {
  const {
    address,
    connected,
    connecting,
    wallet,
    signTransaction,
    disconnect
  } = useWallet();

  const { setVisible } = useWalletModal();

  const connect = () => {
    setVisible(true);
  };

  const sign = async (transaction: any) => {
    if (!signTransaction) {
      throw new Error('Wallet does not support signing');
    }
    return await signTransaction(transaction);
  };

  return {
    address: address || null,
    isConnected: connected,
    isConnecting: connecting,
    walletName: wallet?.adapter.name || null,
    connect,
    disconnect,
    signTransaction: sign
  };
}
```

### `frontend/src/hooks/useTronTransaction.ts`

```typescript
import TronWeb from 'tronweb';

const TRON_API_URL = import.meta.env.VITE_TRON_API_URL || 'https://api.trongrid.io';
const USDT_CONTRACT = import.meta.env.VITE_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const SERVICE_WALLET = import.meta.env.VITE_SERVICE_WALLET;

// TronWeb instance for building transactions (no private key needed)
const tronWeb = new TronWeb({
  fullHost: TRON_API_URL
});

interface BuildTxParams {
  fromAddress: string;
  amount: string; // USDT amount as string
}

export async function buildUsdtTransfer({ fromAddress, amount }: BuildTxParams) {
  const amountSun = Math.floor(parseFloat(amount) * 1e6); // USDT has 6 decimals

  // Build TRC20 transfer transaction
  const parameter = [
    { type: 'address', value: SERVICE_WALLET },
    { type: 'uint256', value: amountSun.toString() }
  ];

  const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
    USDT_CONTRACT,
    'transfer(address,uint256)',
    {
      feeLimit: 100_000_000, // 100 TRX max fee (won't be used with energy)
      callValue: 0
    },
    parameter,
    fromAddress
  );

  return transaction;
}

export async function getUsdtBalance(address: string): Promise<string> {
  try {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const balance = await contract.balanceOf(address).call();
    return (parseInt(balance.toString()) / 1e6).toFixed(6);
  } catch {
    return '0';
  }
}

export async function getTrxBalance(address: string): Promise<string> {
  try {
    const balance = await tronWeb.trx.getBalance(address);
    return (balance / 1e6).toFixed(6);
  } catch {
    return '0';
  }
}
```

## Modified Files

### `frontend/package.json`

Add dependencies:
```json
{
  "@tronweb3/walletconnect-tron": "^4.0.0",
  "@walletconnect/modal": "^2.7.0",
  "tronweb": "^6.0.0"
}
```

### `frontend/.env.example`

```bash
VITE_API_URL=http://localhost:3001
VITE_WALLETCONNECT_PROJECT_ID=your-project-id
VITE_TRON_API_URL=https://api.trongrid.io
VITE_USDT_CONTRACT=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
VITE_SERVICE_WALLET=TYourServiceWalletAddress
```

## Error Handling

```typescript
// Common WalletConnect error patterns
const handleWalletError = (error: unknown): string => {
  if (error instanceof Error) {
    // Session expired
    if (error.message.includes('No matching key')) {
      return 'Session expired. Please reconnect your wallet.';
    }
    // User rejected
    if (error.message.includes('User rejected') || error.message.includes('cancelled')) {
      return 'Transaction cancelled by user.';
    }
    // Timeout
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return 'Request timed out. Please try again.';
    }
    // Network error
    if (error.message.includes('network') || error.message.includes('relay')) {
      return 'Network error. Check your connection.';
    }
    return error.message;
  }
  return 'Unknown error occurred';
};
```

## WalletConnect Project Setup

1. Go to https://cloud.walletconnect.com
2. Create new project
3. Get Project ID
4. Add to `.env` as `VITE_WALLETCONNECT_PROJECT_ID`

## Implementation Steps

- [ ] Get WalletConnect Project ID from cloud.walletconnect.com
- [ ] Install frontend dependencies
- [ ] Create `useWalletConnect.ts` hook
- [ ] Create `useTronTransaction.ts` hook
- [ ] Add env vars to frontend/.env
- [ ] Test connection with TrustWallet mobile
- [ ] Test transaction signing
- [ ] Handle common error cases

## Wallet Modal UI

The `@tronweb3/tronwallet-adapter-react-ui` provides a built-in modal that shows:
- TronLink (if browser extension detected)
- WalletConnect (for mobile wallets)
- Other supported adapters

Users can choose their preferred connection method.

## Ledger Support

| Setup | How It Works |
|-------|--------------|
| Ledger + Desktop | TronLink extension → connects to Ledger USB |
| Ledger Nano X + Mobile | TronLink app → connects to Ledger Bluetooth |

Both paths work through TronLink adapter - no special Ledger code needed.

## Implementation Steps

- [ ] Install tronwallet-adapter packages
- [ ] Create WalletProvider.tsx
- [ ] Create useTronWallet.ts hook
- [ ] Wrap App with WalletProvider in main.tsx
- [ ] Get WalletConnect Project ID
- [ ] Test TronLink browser extension
- [ ] Test TronLink mobile app (WalletConnect)
- [ ] Test TrustWallet mobile
- [ ] Test Ledger + TronLink

## Success Criteria

- [ ] Wallet modal shows TronLink + WalletConnect options
- [ ] TronLink browser extension connects
- [ ] TronLink mobile app connects via WalletConnect QR
- [ ] TrustWallet mobile connects via WalletConnect
- [ ] Ledger works through TronLink
- [ ] Transaction signing works on all wallets
- [ ] Disconnect clears session
- [ ] Auto-reconnect on page refresh
