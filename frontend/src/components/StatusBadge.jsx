const STATUS_STYLES = {
  confirmed:        { label: 'Confirmed',          cls: 'bg-green-100 text-green-800' },
  processing:       { label: 'Processing',         cls: 'bg-blue-100 text-blue-800' },
  shipped:          { label: 'Shipped',            cls: 'bg-indigo-100 text-indigo-800' },
  delivered:        { label: 'Delivered',          cls: 'bg-emerald-100 text-emerald-800' },
  cancel_requested: { label: 'Cancel requested',   cls: 'bg-amber-100 text-amber-800' },
  cancelled:        { label: 'Cancelled',          cls: 'bg-gray-200 text-gray-700' },
  return_requested: { label: 'Return requested',   cls: 'bg-orange-100 text-orange-800' },
  returned:         { label: 'Returned',           cls: 'bg-rose-100 text-rose-800' },
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_STYLES[status] ?? { label: status, cls: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
