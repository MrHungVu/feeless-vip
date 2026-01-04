interface Props {
  value: string;
  onChange: (v: string) => void;
  maxAmount?: string;
  token: string;
}

export function AmountInput({ value, onChange, maxAmount, token }: Props) {
  return (
    <div className="flex gap-2 items-center">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0.00"
        min="0"
        step="0.01"
        className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:border-blue-500"
      />
      <span className="text-gray-400 w-16">{token.toUpperCase()}</span>
      {maxAmount && parseFloat(maxAmount) > 0 && (
        <button
          onClick={() => onChange(maxAmount)}
          className="text-blue-400 text-sm hover:underline"
        >
          MAX
        </button>
      )}
    </div>
  );
}
