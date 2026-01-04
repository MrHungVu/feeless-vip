import { useState, useCallback } from 'react';
import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { tronApi, Quote, SubmitResponse } from '../services/api';

type Status =
  | 'idle'
  | 'quoting'
  | 'building'
  | 'signing'
  | 'submitting'
  | 'confirmed'
  | 'error';

export function useTronTopUp() {
  const { address, signTransaction, connected } = useWallet();

  const [status, setStatus] = useState<Status>('idle');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getQuote = useCallback(
    async (amount: string) => {
      if (!address) throw new Error('Wallet not connected');

      setStatus('quoting');
      setError(null);

      try {
        const q = await tronApi.getQuote(address, amount);
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
    [address]
  );

  const executeTopUp = useCallback(
    async (amount: string) => {
      if (!address || !signTransaction) throw new Error('Wallet not connected');

      try {
        // Build transaction
        setStatus('building');
        const { transactionId, unsignedTx, quote: txQuote } =
          await tronApi.buildTransaction(address, amount);
        setQuote(txQuote);

        // Sign transaction
        setStatus('signing');
        const signedTx = await signTransaction(unsignedTx);

        // Submit
        setStatus('submitting');
        const submitResult = await tronApi.submit(signedTx, transactionId);

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
    [address, signTransaction]
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
    isConnected: connected && !!address
  };
}
