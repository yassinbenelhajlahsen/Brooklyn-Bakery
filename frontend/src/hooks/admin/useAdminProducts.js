import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminProductsService.js';

const PAGE_SIZE = 10;

export function useAdminProducts() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(true);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listProducts(authedFetch, {
        includeArchived, sort, take: PAGE_SIZE, skip: 0,
      });
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
  }, [authedFetch, includeArchived, sort]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const reqId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const data = await api.listProducts(authedFetch, {
        includeArchived, sort, take: PAGE_SIZE, skip: items.length,
      });
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
  }, [authedFetch, hasMore, loadingMore, items.length, includeArchived, sort]);

  const create = useCallback(async (data) => {
    const created = await api.createProduct(authedFetch, data);
    setItems((prev) => [{ ...created, avgRating: null, reviewCount: 0 }, ...prev]);
    setTotal((t) => t + 1);
    return created;
  }, [authedFetch]);

  const update = useCallback(async (id, data) => {
    const updated = await api.updateProduct(authedFetch, id, data);
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    return updated;
  }, [authedFetch]);

  const archive = useCallback(async (id) => {
    const updated = await api.archiveProduct(authedFetch, id);
    setItems((prev) => {
      if (!includeArchived) {
        setTotal((t) => Math.max(0, t - 1));
        return prev.filter((p) => p.id !== id);
      }
      return prev.map((p) => (p.id === id ? { ...p, ...updated } : p));
    });
    return updated;
  }, [authedFetch, includeArchived]);

  const unarchive = useCallback(async (id) => {
    const updated = await api.unarchiveProduct(authedFetch, id);
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    return updated;
  }, [authedFetch]);

  return {
    items, total, hasMore,
    includeArchived, setIncludeArchived,
    sort, setSort,
    loading, loadingMore, error,
    refresh, loadMore,
    create, update, archive, unarchive,
  };
}
