interface Quote {
  youPay: string;
  youReceive: string;
  serviceFee: string;
}

export function QuoteDisplay({ quote }: { quote: Quote | null }) {
  if (!quote) return null;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
      <div className="flex justify-between">
        <span className="text-gray-400">You pay:</span>
        <span>{quote.youPay} USDT</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">You receive:</span>
        <span className="text-green-400">~{quote.youReceive} TRX</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Service fee:</span>
        <span className="text-gray-400">{quote.serviceFee} USDT</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Network fee:</span>
        <span className="text-green-400">Covered ✓</span>
      </div>
    </div>
  );
}
