import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminUsersService.js';

const PAGE_SIZE = 10;

export function useAdminUsers() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listUsers(authedFetch, { take: PAGE_SIZE, skip: 0 });
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
  }, [authedFetch]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const reqId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const data = await api.listUsers(authedFetch, { take: PAGE_SIZE, skip: items.length });
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
  }, [authedFetch, hasMore, loadingMore, items.length]);

  const getOne = useCallback((id) => api.getUser(authedFetch, id), [authedFetch]);

  const setRole = useCallback(async (id, role) => {
    const updated = await api.updateRole(authedFetch, id, role);
    setItems((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    return updated;
  }, [authedFetch]);

  const adjustBalance = useCallback(async (id, delta) => {
    const updated = await api.adjustBalance(authedFetch, id, delta);
    setItems((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    return updated;
  }, [authedFetch]);

  return {
    items, total, hasMore,
    loading, loadingMore, error,
    refresh, loadMore,
    getOne, setRole, adjustBalance,
  };
}
