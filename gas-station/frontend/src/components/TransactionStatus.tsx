interface Props {
  status: string;
  result: { txHash: string } | null;
  onReset: () => void;
  chain: 'solana' | 'tron';
}

const statusMessages: Record<string, string> = {
  quoting: 'Getting quote...',
  building: 'Preparing transaction...',
  signing: 'Please sign in your wallet...',
  submitting: 'Submitting transaction...',
  confirmed: 'Transaction confirmed!'
};

export function TransactionStatus({ status, result, onReset, chain }: Props) {
  const explorerUrl =
    chain === 'solana'
      ? `https://solscan.io/tx/${result?.txHash}`
      : `https://tronscan.org/#/transaction/${result?.txHash}`;

  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        {status === 'confirmed' ? (
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      <p className="text-lg font-medium text-gray-900">
        {statusMessages[status] || 'Processing...'}
      </p>

      {result?.txHash && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 hover:underline text-sm"
        >
          View on Explorer
        </a>
      )}

      {status === 'confirmed' && (
        <button
          onClick={onReset}
          className="mt-4 px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Make Another Transaction
        </button>
      )}
    </div>
  );
}
