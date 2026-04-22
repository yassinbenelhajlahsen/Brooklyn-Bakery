import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminOrdersService.js';

export function useAdminOrders() {
  const { authedFetch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listOrders(authedFetch, status ? { status } : {});
      setOrders(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [authedFetch, status]);

  useEffect(() => { refresh(); }, [refresh]);

  const transition = useCallback(async (id, action, reason) => {
    const updated = await api.transitionOrder(authedFetch, id, action, reason);
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, ...updated } : o));
      // If an active filter excludes the new status, drop the item from the list.
      if (status && updated.status !== status) {
        return next.filter((o) => o.id !== id);
      }
      return next;
    });
    return updated;
  }, [authedFetch, status]);

  return { orders, status, setStatus, loading, error, refresh, transition };
}
