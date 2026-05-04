import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminOrdersService.js';

const PAGE_SIZE = 10;

export function useAdminOrders() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const args = { take: PAGE_SIZE, skip: 0, ...(status ? { status } : {}) };
      const data = await api.listOrders(authedFetch, args);
      if (requestIdRef.current !== reqId) return;
      setItems(data.items);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setError(err.message);
    } finally {
      if (requestIdRef.current === reqId) setLoading(false);
    }
  }, [authedFetch, status]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const reqId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const args = { take: PAGE_SIZE, skip: items.length, ...(status ? { status } : {}) };
      const data = await api.listOrders(authedFetch, args);
      if (requestIdRef.current !== reqId) return;
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      if (requestIdRef.current !== reqId) return;
      setError(err.message);
    } finally {
      if (requestIdRef.current === reqId) setLoadingMore(false);
    }
  }, [authedFetch, hasMore, loadingMore, items.length, status]);

  const transition = useCallback(async (id, action, reason) => {
    const updated = await api.transitionOrder(authedFetch, id, action, reason);
    setItems((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, ...updated } : o));
      if (status && updated.status !== status) {
        setTotal((t) => Math.max(0, t - 1));
        return next.filter((o) => o.id !== id);
      }
      return next;
    });
    return updated;
  }, [authedFetch, status]);

  return {
    items, total, hasMore, status,
    loading, loadingMore, error,
    refresh, loadMore, setStatus, transition,
  };
}
