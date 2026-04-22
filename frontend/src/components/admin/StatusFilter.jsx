const STATUSES = [
  { value: '',                 label: 'All statuses' },
  { value: 'confirmed',        label: 'Confirmed' },
  { value: 'processing',       label: 'Processing' },
  { value: 'shipped',          label: 'Shipped' },
  { value: 'delivered',        label: 'Delivered' },
  { value: 'cancel_requested', label: 'Cancel requested' },
  { value: 'cancelled',        label: 'Cancelled' },
  { value: 'return_requested', label: 'Return requested' },
  { value: 'returned',         label: 'Returned' },
];

export default function StatusFilter({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-line rounded-md px-2 py-1.5 text-sm bg-surface text-ink focus:outline-none focus:border-accent"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}
