interface NetworkOption {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

const NETWORKS: NetworkOption[] = [
  { id: 'tron', name: 'TRON', icon: '🔴', enabled: true },
  { id: 'solana', name: 'Solana', icon: '🟣', enabled: false }
];

export function NetworkSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {NETWORKS.map(net => (
        <button
          key={net.id}
          onClick={() => net.enabled && onChange(net.id)}
          disabled={!net.enabled}
          className={`
            px-4 py-2 rounded-lg border transition-colors
            ${value === net.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}
            ${!net.enabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}
          `}
        >
          {net.icon} {net.name}
          {!net.enabled && <span className="text-xs ml-1">(Soon)</span>}
        </button>
      ))}
    </div>
  );
}
