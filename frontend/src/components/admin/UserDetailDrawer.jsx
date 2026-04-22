import { useCallback, useEffect, useState } from 'react';
import StatusBadge from '../StatusBadge.jsx';

const ANIM_MS = 250;

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">{children}</p>
  );
}

function DrawerSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-cream/50 rounded-lg px-3 py-2.5 space-y-1.5">
            <div className="h-2.5 bg-cream rounded w-16" />
            <div className="h-4 bg-cream rounded w-24" />
          </div>
        ))}
      </div>
      <div className="bg-cream/50 rounded-lg px-3 py-2.5 space-y-1.5">
        <div className="h-2.5 bg-cream rounded w-12" />
        <div className="h-8 bg-cream rounded w-48" />
      </div>
      <div className="bg-cream/50 rounded-lg px-3 py-2.5 space-y-1.5">
        <div className="h-2.5 bg-cream rounded w-16" />
        <div className="h-8 bg-cream rounded w-64" />
      </div>
      <div className="space-y-2">
        <div className="h-2.5 bg-cream rounded w-20" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 bg-cream/40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function UserDetailDrawer({
  userId,
  currentUserId,
  onClose,
  fetchUser,
  onRoleChange,
  onAdjustBalance,
}) {
  const [user, setUser] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [mutating, setMutating] = useState(false);
  const [roleError, setRoleError] = useState(null);

  const [delta, setDelta] = useState('');
  const [balanceError, setBalanceError] = useState(null);

  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const isSelf = userId === currentUserId;

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const closeWithAnim = useCallback(() => {
    setLeaving(true);
    setTimeout(onClose, ANIM_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeWithAnim(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeWithAnim]);

  async function loadUser(id) {
    setFetchLoading(true);
    setFetchError(null);
    setUser(null);
    try {
      const data = await fetchUser(id);
      setUser(data);
    } catch (err) {
      setFetchError(err.message ?? 'Failed to load user.');
    } finally {
      setFetchLoading(false);
    }
  }

  useEffect(() => {
    if (userId) {
      setDelta('');
      setRoleError(null);
      setBalanceError(null);
      loadUser(userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleRoleToggle() {
    if (mutating || !user) return;
    const nextRole = user.role === 'admin' ? 'customer' : 'admin';
    setMutating(true);
    setRoleError(null);
    try {
      await onRoleChange(userId, nextRole);
      await loadUser(userId);
    } catch (err) {
      setRoleError(err.message ?? 'Role change failed.');
    } finally {
      setMutating(false);
    }
  }

  async function handleBalanceSubmit(e) {
    e.preventDefault();
    if (mutating || !user) return;

    const numDelta = Number(delta);
    if (!delta || numDelta === 0) {
      setBalanceError('Enter a non-zero integer.');
      return;
    }
    if (user.balance + numDelta < 0) {
      setBalanceError('Cannot go below 0.');
      return;
    }

    setMutating(true);
    setBalanceError(null);
    try {
      await onAdjustBalance(userId, numDelta);
      setDelta('');
      await loadUser(userId);
    } catch (err) {
      setBalanceError(err.message ?? 'Balance adjustment failed.');
    } finally {
      setMutating(false);
    }
  }

  if (!userId) return null;

  const shortId = userId.slice(0, 8);
  const visible = entered && !leaving;

  return (
    <>
      <div
        className={`fixed inset-0 h-dvh z-40 bg-black/50 transition-opacity duration-250 ease-out ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeWithAnim}
        aria-hidden="true"
      />

      <aside
        className={`fixed top-0 right-0 h-dvh w-120 max-w-full max-sm:w-full bg-surface border-l border-line shadow-[-12px_0_40px_rgba(61,47,36,0.12)] z-50 flex flex-col overflow-hidden transition-transform duration-250 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label={`User ${user?.displayName ?? shortId} details`}
      >
        <div className="px-6 py-4 border-b border-line bg-cream/40 flex items-center justify-between shrink-0">
          <span className="font-display text-xl [font-variation-settings:'opsz'_24] text-ink">
            {fetchLoading ? (
              <span className="inline-block h-5 w-32 bg-cream rounded animate-pulse" />
            ) : (
              user?.displayName || '—'
            )}
          </span>
          <button
            onClick={closeWithAnim}
            aria-label="Close drawer"
            className="w-8 h-8 rounded-full hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        {fetchLoading ? (
          <DrawerSkeleton />
        ) : fetchError ? (
          <div className="flex-1 px-6 py-5">
            <div className="border border-line bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
              {fetchError}
            </div>
          </div>
        ) : user ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Identity grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-cream/50 rounded-lg px-3 py-2.5">
                <SectionLabel>Display name</SectionLabel>
                <p className="text-sm font-medium text-ink">{user.displayName || '—'}</p>
              </div>
              <div className="bg-cream/50 rounded-lg px-3 py-2.5">
                <SectionLabel>Joined</SectionLabel>
                <p className="text-sm font-medium text-ink">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-cream/50 rounded-lg px-3 py-2.5 col-span-2">
                <SectionLabel>User ID</SectionLabel>
                <p className="text-sm font-mono text-muted">{user.id.slice(0, 8)}</p>
              </div>
            </div>

            {/* Role section */}
            <div>
              <SectionLabel>Role</SectionLabel>
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  title={isSelf ? 'Cannot change your own role' : undefined}
                  className="inline-flex"
                >
                  <div
                    className={`flex rounded-lg border border-line overflow-hidden ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={!isSelf ? handleRoleToggle : undefined}
                      disabled={mutating || isSelf || user.role === 'customer'}
                      aria-pressed={user.role === 'customer'}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                        user.role === 'customer'
                          ? 'bg-cream/70 text-muted cursor-default'
                          : 'bg-surface text-muted hover:bg-cream/40 disabled:opacity-50'
                      }`}
                    >
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={!isSelf ? handleRoleToggle : undefined}
                      disabled={mutating || isSelf || user.role === 'admin'}
                      aria-pressed={user.role === 'admin'}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed border-l border-line ${
                        user.role === 'admin'
                          ? 'bg-accent/10 text-accent cursor-default'
                          : 'bg-surface text-muted hover:bg-cream/40 disabled:opacity-50'
                      }`}
                    >
                      Admin
                    </button>
                  </div>
                </span>
                {mutating && (
                  <span className="text-muted text-xs">Saving…</span>
                )}
              </div>
              {roleError && (
                <p className="text-danger text-xs mt-1.5">{roleError}</p>
              )}
            </div>

            {/* Balance section */}
            <div>
              <SectionLabel>Balance</SectionLabel>
              <p className="text-sm font-mono font-semibold text-ink mb-2">
                {user.balance} pts
              </p>
              <form onSubmit={handleBalanceSubmit} className="flex items-center gap-2">
                <input
                  type="number"
                  value={delta}
                  onChange={(e) => {
                    setDelta(e.target.value);
                    setBalanceError(null);
                  }}
                  placeholder="±delta"
                  step="1"
                  disabled={mutating}
                  className="w-28 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-mono text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={mutating}
                  className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Apply
                </button>
              </form>
              {balanceError && (
                <p className="text-danger text-xs mt-1.5">{balanceError}</p>
              )}
            </div>

            {/* Orders section */}
            <div>
              <SectionLabel>Orders ({user.orders?.length ?? 0})</SectionLabel>
              {!user.orders || user.orders.length === 0 ? (
                <p className="text-muted text-sm">No orders yet.</p>
              ) : (
                <ul className="space-y-2">
                  {user.orders.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-3 bg-cream/40 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs text-muted shrink-0">
                          #{order.id.slice(-8)}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="text-sm font-semibold text-ink font-mono">
                          {order.total} pts
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        ) : null}
      </aside>
    </>
  );
}
