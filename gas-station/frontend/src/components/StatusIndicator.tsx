export type FlowStatus = 'idle' | 'connecting' | 'signing' | 'committing' | 'processing' | 'success' | 'error';

const STATUS_CONFIG: Record<FlowStatus, { text: string; color: string }> = {
  idle: { text: 'Ready', color: 'text-gray-400' },
  connecting: { text: 'Connecting wallet...', color: 'text-yellow-400' },
  signing: { text: 'Please sign in your wallet...', color: 'text-yellow-400' },
  committing: { text: 'Validating transaction...', color: 'text-blue-400' },
  processing: { text: 'Processing transaction...', color: 'text-blue-400' },
  success: { text: 'Transaction complete!', color: 'text-green-400' },
  error: { text: 'Error occurred', color: 'text-red-400' }
};

export function StatusIndicator({
  status,
  message,
  txHash
}: {
  status: FlowStatus;
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
