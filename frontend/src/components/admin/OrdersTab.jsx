import { useState } from 'react';
import { useAdminOrders } from '../../hooks/admin/useAdminOrders.js';
import StatusBadge from '../StatusBadge.jsx';
import StatusFilter from './StatusFilter.jsx';
import OrderDetailDrawer from './OrderDetailDrawer.jsx';

const COLUMNS = ['Order', 'Customer', 'Items', 'Total', 'Status', 'Date'];

function SkeletonRow() {
  return (
    <tr className="border-b border-line animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-8" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-cream rounded-full w-24" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-28" /></td>
    </tr>
  );
}

export default function OrdersTab() {
  const { orders, status, setStatus, loading, error, refresh, transition } = useAdminOrders();
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <StatusFilter value={status} onChange={setStatus} />
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 border border-line rounded-md px-3 py-1.5 text-sm text-ink hover:bg-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
              clipRule="evenodd"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border border-line bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream/60 border-b border-line">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-muted font-medium"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order, idx) => (
                <tr
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className={`border-b border-line last:border-b-0 cursor-pointer hover:bg-accent/5 transition-colors duration-100 ${
                    idx % 2 === 1 ? 'bg-cream/30' : 'bg-surface'
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-muted">
                    #{order.id.slice(-8)}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {order.user?.displayName || '—'}
                  </td>
                  <td className="px-4 py-3 text-ink">{order.items.length}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{order.total} pts</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <OrderDetailDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onTransition={async (action, reason) => {
            const updated = await transition(selected.id, action, reason);
            setSelected(updated);
          }}
        />
      )}
    </div>
  );
}
