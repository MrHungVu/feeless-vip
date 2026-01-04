import { useState, useEffect, useCallback } from 'react';
import { useTronWallet } from '../hooks/useTronWallet';
import { buildUsdtTransfer, getUsdtBalance, handleWalletError } from '../hooks/useTronTransaction';
import { NetworkSelector } from '../components/NetworkSelector';
import { TokenSelector } from '../components/TokenSelector';
import { AmountInput } from '../components/AmountInput';
import { QuoteDisplay } from '../components/QuoteDisplay';
import { StatusIndicator, FlowStatus } from '../components/StatusIndicator';
import { tronApi, TronQuoteResponse } from '../services/api';

export function Home() {
  const { address, isConnected, isConnecting, walletName, connect, disconnect, signTransaction } = useTronWallet();

  const [network, setNetwork] = useState('tron');
  const [token, setToken] = useState('usdt');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [quote, setQuote] = useState<TronQuoteResponse | null>(null);
  const [serviceWallet, setServiceWallet] = useState<string | null>(null);
  const [status, setStatus] = useState<FlowStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Fetch service wallet on mount
  useEffect(() => {
    tronApi.getServiceWallet()
      .then(res => setServiceWallet(res.address))
      .catch(() => setServiceWallet(null));
  }, []);

  // Fetch balance when connected
  useEffect(() => {
    if (address) {
      getUsdtBalance(address).then(setBalance);
    } else {
      setBalance(null);
    }
  }, [address]);

  // Fetch quote when amount changes (debounced)
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !address) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(() => {
      tronApi.getQuoteRaw(address, amount)
        .then(setQuote)
        .catch(() => setQuote(null));
    }, 300);

    return () => clearTimeout(timer);
  }, [amount, address]);

  const handleConnect = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    try {
      await connect();
      setStatus('idle');
    } catch (e) {
      setError(handleWalletError(e));
      setStatus('error');
    }
  }, [connect]);

  const handleSend = useCallback(async () => {
    if (!address || !quote || !serviceWallet) return;

    setError(null);
    setTxHash(null);

    try {
      // 1. Build transaction
      setStatus('signing');
      const tx = await buildUsdtTransfer({
        fromAddress: address,
        toAddress: serviceWallet,
        amount: quote.totalUsdtCharged
      });

      // 2. Sign with wallet
      const signedTx = await signTransaction(tx);

      // 3. Commit to backend
      setStatus('committing');
      const { commitId } = await tronApi.commit({
        signedTx,
        quoteId: quote.quoteId,
        expectedAmount: quote.totalUsdtCharged,
        userAddress: address
      });

      // 4. Execute
      setStatus('processing');
      const result = await tronApi.execute(commitId);

      if (result.success) {
        setTxHash(result.usdtTxHash || null);
        setStatus('success');
        setAmount('');
        // Refresh balance
        if (address) {
          getUsdtBalance(address).then(setBalance);
        }
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (e) {
      setError(handleWalletError(e));
      setStatus('error');
    }
  }, [address, quote, serviceWallet, signTransaction]);

  const resetStatus = useCallback(() => {
    if (status === 'success' || status === 'error') {
      setStatus('idle');
      setError(null);
    }
  }, [status]);

  const canSend = isConnected && quote && status === 'idle' && serviceWallet;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">⛽ Gas Station</h1>
          <p className="text-gray-400 text-sm">Get TRX without paying gas fees</p>
        </div>

        {/* Form */}
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
              onChange={(v) => { setAmount(v); resetStatus(); }}
              maxAmount={balance || undefined}
              token={token}
            />
            {balance && (
              <p className="text-xs text-gray-500 mt-1">Balance: {balance} USDT</p>
            )}
          </div>
        </div>

        {/* Quote */}
        <QuoteDisplay quote={quote ? {
          youPay: quote.totalUsdtCharged,
          youReceive: quote.trxAmount,
          serviceFee: quote.serviceFee
        } : null} />

        {/* Actions */}
        <div className="space-y-3">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting || status === 'connecting'}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {isConnecting || status === 'connecting' ? 'Connecting...' : '🔗 Connect Wallet'}
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  {walletName}: {address?.slice(0, 8)}...{address?.slice(-6)}
                </span>
                <button
                  onClick={disconnect}
                  className="text-red-400 hover:underline"
                  disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
                >
                  Disconnect
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {status === 'signing' ? 'Sign in wallet...' :
                 status === 'committing' ? 'Validating...' :
                 status === 'processing' ? 'Processing...' :
                 'Send USDT →'}
              </button>
            </>
          )}
        </div>

        {/* Status */}
        <StatusIndicator
          status={status}
          message={error || undefined}
          txHash={txHash || undefined}
        />

        {/* Footer */}
        <p className="text-xs text-gray-500 text-center">
          Connect via WalletConnect (TrustWallet, Ledger Live, etc.)
        </p>
      </div>
    </div>
  );
}
