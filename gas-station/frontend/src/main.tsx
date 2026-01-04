import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Solana
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

// TRON
import { WalletProvider as TronWalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { WalletModalProvider as TronModalProvider } from '@tronweb3/tronwallet-adapter-react-ui';
import { LedgerAdapter } from '@tronweb3/tronwallet-adapters';
import '@tronweb3/tronwallet-adapter-react-ui/style.css';

const solanaEndpoint = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const solanaWallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

// Ledger only for now (testing)
// Create adapter and attach error handler to auto-disconnect on error
const ledgerAdapter = new LedgerAdapter();

// Listen for errors and reset adapter state
ledgerAdapter.on('error', (error) => {
  console.log('[LedgerAdapter] Error:', error);
  console.log('[LedgerAdapter] Current state:', ledgerAdapter.state);
  console.log('[LedgerAdapter] Attempting disconnect to reset...');
  // Disconnect to reset state so user can try again
  ledgerAdapter.disconnect().then(() => {
    console.log('[LedgerAdapter] Disconnected, new state:', ledgerAdapter.state);
  }).catch((e) => {
    console.log('[LedgerAdapter] Disconnect failed:', e, 'state:', ledgerAdapter.state);
  });
});

ledgerAdapter.on('stateChanged', (state) => {
  console.log('[LedgerAdapter] State changed to:', state);
});

ledgerAdapter.on('connect', () => {
  console.log('[LedgerAdapter] Connected! Address:', ledgerAdapter.address);
});

ledgerAdapter.on('disconnect', () => {
  console.log('[LedgerAdapter] Disconnected event fired');
});

const tronAdapters = [ledgerAdapter];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConnectionProvider endpoint={solanaEndpoint}>
      <WalletProvider wallets={solanaWallets} autoConnect>
        <WalletModalProvider>
          <TronWalletProvider adapters={tronAdapters} autoConnect>
            <TronModalProvider>
              <App />
            </TronModalProvider>
          </TronWalletProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>
);
