import { useState } from 'react';
import { useAdminUsers } from '../../hooks/admin/useAdminUsers.js';
import { useAuth } from '../../auth/useAuth.js';
import UserDetailDrawer from './UserDetailDrawer.jsx';
import LoadMoreFooter from '../LoadMoreFooter.jsx';

const COLUMNS = ['Display name', 'Role', 'Balance', 'Orders', 'Joined'];

function SkeletonRow() {
  return (
    <tr className="border-b border-line animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-cream rounded-full w-20" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-8" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-cream rounded w-24" /></td>
    </tr>
  );
}

export default function UsersTab() {
  const { user } = useAuth();
  const {
    items, total, hasMore,
    loading, loadingMore, error,
    loadMore, getOne, setRole, adjustBalance,
  } = useAdminUsers();
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="border border-line bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col />
            <col style={{ width: '7rem' }} />
            <col style={{ width: '6rem' }} />
            <col style={{ width: '5rem' }} />
            <col style={{ width: '9rem' }} />
          </colgroup>
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
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              items.map((u, idx) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className={`border-b border-line last:border-b-0 cursor-pointer hover:bg-accent/5 transition-colors duration-100 ${
                    idx % 2 === 1 ? 'bg-cream/30' : 'bg-surface'
                  }`}
                >
                  <td className="px-4 py-3 text-ink font-medium truncate">
                    {u.displayName || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cream/70 text-muted">
                        Customer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-ink truncate">{u.balance} pts</td>
                  <td className="px-4 py-3 font-mono text-ink">{u.orderCount}</td>
                  <td className="px-4 py-3 text-muted truncate">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadMoreFooter
        shown={items.length}
        total={total}
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />

      {/* Detail drawer */}
      {selectedId && (
        <UserDetailDrawer
          userId={selectedId}
          currentUserId={user?.id}
          fetchUser={getOne}
          onClose={() => setSelectedId(null)}
          onRoleChange={setRole}
          onAdjustBalance={adjustBalance}
        />
      )}
    </div>
  );
}
