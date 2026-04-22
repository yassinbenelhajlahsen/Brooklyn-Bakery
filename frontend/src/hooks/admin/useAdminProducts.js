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

  const create = useCallback(async (data) => { await api.createProduct(authedFetch, data); await refresh(); }, [authedFetch, refresh]);
  const update = useCallback(async (id, data) => { await api.updateProduct(authedFetch, id, data); await refresh(); }, [authedFetch, refresh]);
  const archive = useCallback(async (id) => { await api.archiveProduct(authedFetch, id); await refresh(); }, [authedFetch, refresh]);
  const unarchive = useCallback(async (id) => { await api.unarchiveProduct(authedFetch, id); await refresh(); }, [authedFetch, refresh]);

  return { products, includeArchived, setIncludeArchived, loading, error, refresh, create, update, archive, unarchive };
}
