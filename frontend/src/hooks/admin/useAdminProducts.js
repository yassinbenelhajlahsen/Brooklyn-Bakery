import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminProductsService.js';

export function useAdminProducts() {
  const { authedFetch } = useAuth();
  const [products, setProducts] = useState([]);
  const [includeArchived, setIncludeArchived] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listProducts(authedFetch, { includeArchived });
      setProducts(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [authedFetch, includeArchived]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (data) => {
    const created = await api.createProduct(authedFetch, data);
    setProducts((prev) => [created, ...prev]);
    return created;
  }, [authedFetch]);

  const update = useCallback(async (id, data) => {
    const updated = await api.updateProduct(authedFetch, id, data);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, [authedFetch]);

  const archive = useCallback(async (id) => {
    const updated = await api.archiveProduct(authedFetch, id);
    setProducts((prev) => {
      const next = prev.map((p) => (p.id === id ? updated : p));
      if (!includeArchived) return next.filter((p) => !p.archivedAt);
      return next;
    });
    return updated;
  }, [authedFetch, includeArchived]);

  const unarchive = useCallback(async (id) => {
    const updated = await api.unarchiveProduct(authedFetch, id);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, [authedFetch]);

  return { products, includeArchived, setIncludeArchived, loading, error, refresh, create, update, archive, unarchive };
}
