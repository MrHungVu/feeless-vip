type Chain = 'solana' | 'tron';

interface Props {
  selected: Chain;
  onSelect: (chain: Chain) => void;
}

export function ChainSelector({ selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
      <button
        onClick={() => onSelect('solana')}
        className={`flex-1 py-3 px-4 rounded-md font-medium transition ${
          selected === 'solana'
            ? 'bg-white shadow text-purple-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Solana (USDC)
      </button>
      <button
        onClick={() => onSelect('tron')}
        className={`flex-1 py-3 px-4 rounded-md font-medium transition ${
          selected === 'tron'
            ? 'bg-white shadow text-red-600'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        TRON (USDT)
      </button>
    </div>
  );
}
