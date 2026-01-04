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

// TRON wallet adapters - Ledger only for now
const ledgerAdapter = new LedgerAdapter();
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
