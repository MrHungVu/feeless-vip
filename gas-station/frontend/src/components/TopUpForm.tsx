import { useState, useEffect } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWallet as useTronWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useWalletModal } from '@tronweb3/tronwallet-adapter-react-ui';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSolanaTopUp } from '../hooks/use-solana-topup';
import { useTronTopUp } from '../hooks/use-tron-topup';
import { TransactionStatus } from './TransactionStatus';

interface Props {
  chain: 'solana' | 'tron';
}

export function TopUpForm({ chain }: Props) {
  const [amount, setAmount] = useState('10');
  const solanaWallet = useSolanaWallet();
  const tronWallet = useTronWallet();
  const { setVisible, visible } = useWalletModal();

  const solanaTopUp = useSolanaTopUp();
  const tronTopUp = useTronTopUp();

  const topUp = chain === 'solana' ? solanaTopUp : tronTopUp;
  const isConnected =
    chain === 'solana' ? solanaWallet.connected : tronWallet.connected;
  const stablecoin = chain === 'solana' ? 'USDC' : 'USDT';
  const nativeToken = chain === 'solana' ? 'SOL' : 'TRX';

  // Debug: Log wallet state changes
  useEffect(() => {
    console.log('[TRON Wallet State]', {
      connected: tronWallet.connected,
      connecting: tronWallet.connecting,
      address: tronWallet.address,
      wallet: tronWallet.wallet?.adapter?.name,
      walletState: tronWallet.wallet?.adapter?.state,
      modalVisible: visible
    });
  }, [tronWallet.connected, tronWallet.connecting, tronWallet.address, tronWallet.wallet, visible]);

  // Reset adapter state on error (e.g., when user denies Ledger access)
  useEffect(() => {
    if (chain !== 'tron') return;

    const handleError = (error: unknown) => {
      console.log('[TRON Adapter Error]', error);
      // Force disconnect to reset adapter state
      tronWallet.disconnect().catch((e) => {
        console.log('[TRON Disconnect Error]', e);
      });
    };

    const handleConnect = () => {
      console.log('[TRON Adapter Connected]');
    };

    const handleDisconnect = () => {
      console.log('[TRON Adapter Disconnected]');
    };

    const handleStateChange = (state: unknown) => {
      console.log('[TRON Adapter State Change]', state);
    };

    // Listen for wallet adapter events
    const adapter = tronWallet.wallet?.adapter;
    if (adapter) {
      console.log('[TRON Adapter] Attaching listeners to:', adapter.name);
      adapter.on('error', handleError);
      adapter.on('connect', handleConnect);
      adapter.on('disconnect', handleDisconnect);
      adapter.on('stateChanged', handleStateChange);
      return () => {
        adapter.off('error', handleError);
        adapter.off('connect', handleConnect);
        adapter.off('disconnect', handleDisconnect);
        adapter.off('stateChanged', handleStateChange);
      };
    }
  }, [chain, tronWallet.wallet?.adapter, tronWallet.disconnect]);

  // Custom TRON connect button that properly resets modal state
  const handleTronConnect = async () => {
    console.log('[handleTronConnect] Button clicked!');
    console.log('[handleTronConnect] Current state:', {
      connected: tronWallet.connected,
      connecting: tronWallet.connecting,
      walletState: tronWallet.wallet?.adapter?.state,
      modalVisible: visible
    });

    // Ensure clean state before connecting
    if (tronWallet.wallet?.adapter) {
      try {
        console.log('[handleTronConnect] Disconnecting first...');
        await tronWallet.disconnect();
        console.log('[handleTronConnect] Disconnected');
      } catch (e) {
        console.log('[handleTronConnect] Disconnect error (ignored):', e);
      }
    }

    console.log('[handleTronConnect] Calling setVisible(true)...');
    setVisible(true);
    console.log('[handleTronConnect] setVisible(true) called');
  };

  const handleTronDisconnect = async () => {
    try {
      await tronWallet.disconnect();
    } catch (e) {
      console.error('Disconnect error:', e);
    }
  };

  // Debounced quote fetch
  useEffect(() => {
    if (!isConnected || !amount || parseFloat(amount) <= 0) return;

    const timer = setTimeout(() => {
      topUp.getQuote(amount).catch(() => {});
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, isConnected, topUp.getQuote]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await topUp.executeTopUp(amount);
  };

  // Show transaction progress
  if (topUp.status !== 'idle' && topUp.status !== 'error') {
    return (
      <TransactionStatus
        status={topUp.status}
        result={topUp.result}
        onReset={topUp.reset}
        chain={chain}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Connect */}
      <div className="flex justify-center">
        {chain === 'solana' ? (
          <WalletMultiButton />
        ) : tronWallet.connected ? (
          <button
            onClick={handleTronDisconnect}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
          >
            Disconnect ({tronWallet.address?.slice(0, 6)}...{tronWallet.address?.slice(-4)})
          </button>
        ) : (
          <button
            onClick={handleTronConnect}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            Connect TRON Wallet
          </button>
        )}
      </div>

      {isConnected && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              You Pay ({stablecoin})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              max="500"
              step="0.01"
              className="w-full px-4 py-3 border rounded-lg text-lg font-mono"
              placeholder="10.00"
            />
          </div>

          {/* Quote Display */}
          {topUp.quote && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">You Receive</span>
                <span className="font-medium">
                  {topUp.quote.nativeAmount} {nativeToken}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Service Fee</span>
                <span>
                  {topUp.quote.serviceFee} {stablecoin}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Network Fee</span>
                <span>
                  {topUp.quote.networkFee} {stablecoin}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total</span>
                <span>
                  {topUp.quote.totalCharged} {stablecoin}
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {topUp.error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {topUp.error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!topUp.quote || topUp.status !== 'idle'}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get {nativeToken}
          </button>
        </form>
      )}
    </div>
  );
}
