const TOKENS = [
  { id: 'usdt', name: 'USDT', icon: '💵' },
  { id: 'usdc', name: 'USDC', icon: '💲', disabled: true }
];

export function TokenSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 w-full"
    >
      {TOKENS.map(t => (
        <option key={t.id} value={t.id} disabled={t.disabled}>
          {t.icon} {t.name} {t.disabled && '(Soon)'}
        </option>
      ))}
    </select>
  );
}
