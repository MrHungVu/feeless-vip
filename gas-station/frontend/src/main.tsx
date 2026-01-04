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
import { WalletConnectAdapter } from '@tronweb3/tronwallet-adapter-walletconnect';
import { LedgerAdapter } from '@tronweb3/tronwallet-adapter-ledger';
import '@tronweb3/tronwallet-adapter-react-ui/style.css';

const solanaEndpoint = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const solanaWallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

// TRON wallets - Ledger Direct (Chrome/Edge) + WalletConnect fallback
const ledgerAdapter = new LedgerAdapter({
  accountNumber: 10, // Show up to 10 accounts for user selection
});

const walletConnectAdapter = new WalletConnectAdapter({
  network: 'Mainnet',
  options: {
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    metadata: {
      name: 'Gas Station',
      description: 'Get TRX without gas fees',
      url: 'https://feeless.vip',
      icons: ['https://feeless.vip/favicon.ico']
    }
  }
});

// Conditional loading: Ledger only on browsers with WebHID support (Chrome/Edge)
const supportsWebHID = typeof navigator !== 'undefined' && 'hid' in navigator;
const tronAdapters = [
  ...(supportsWebHID ? [ledgerAdapter] : []),
  walletConnectAdapter
];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConnectionProvider endpoint={solanaEndpoint}>
      <WalletProvider wallets={solanaWallets} autoConnect>
        <WalletModalProvider>
          <TronWalletProvider adapters={tronAdapters} autoConnect={false}>
            <TronModalProvider>
              <App />
            </TronModalProvider>
          </TronWalletProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>
);
