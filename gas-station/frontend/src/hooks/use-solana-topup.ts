import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { solanaApi, Quote, SubmitResponse } from '../services/api';

type Status =
  | 'idle'
  | 'quoting'
  | 'building'
  | 'signing'
  | 'submitting'
  | 'confirmed'
  | 'error';

export function useSolanaTopUp() {
  const { publicKey, signTransaction } = useWallet();

  const [status, setStatus] = useState<Status>('idle');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getQuote = useCallback(
    async (amount: string) => {
      if (!publicKey) throw new Error('Wallet not connected');

      setStatus('quoting');
      setError(null);

      try {
        const q = await solanaApi.getQuote(publicKey.toString(), amount);
        setQuote(q);
        setStatus('idle');
        return q;
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setError(errorMessage);
        setStatus('error');
        throw e;
      }
    },
    [publicKey]
  );

  const executeTopUp = useCallback(
    async (amount: string) => {
      if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

      try {
        // Build transaction
        setStatus('building');
        const { transactionId, unsignedTx, quote: txQuote } =
          await solanaApi.buildTransaction(publicKey.toString(), amount);
        setQuote(txQuote);

        // Sign transaction
        setStatus('signing');
        const txBuffer = Buffer.from(unsignedTx, 'base64');
        const tx = Transaction.from(txBuffer);
        const signedTx = await signTransaction(tx);
        const signedTxBase64 = signedTx.serialize().toString('base64');

        // Submit
        setStatus('submitting');
        const submitResult = await solanaApi.submit(signedTxBase64, transactionId);

        if (submitResult.status === 'confirmed') {
          setStatus('confirmed');
          setResult(submitResult);
        } else {
          throw new Error(submitResult.error || 'Transaction failed');
        }

        return submitResult;
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setError(errorMessage);
        setStatus('error');
        throw e;
      }
    },
    [publicKey, signTransaction]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setQuote(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    status,
    quote,
    result,
    error,
    getQuote,
    executeTopUp,
    reset,
    isConnected: !!publicKey
  };
}
