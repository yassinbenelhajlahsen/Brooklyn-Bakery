import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import * as api from '../../services/admin/adminUsersService.js';

export function useAdminUsers() {
  const { authedFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setUsers(await api.listUsers(authedFetch)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { refresh(); }, [refresh]);

  const getOne = useCallback((id) => api.getUser(authedFetch, id), [authedFetch]);

  const setRole = useCallback(async (id, role) => {
    const updated = await api.updateRole(authedFetch, id, role);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    return updated;
  }, [authedFetch]);

  const adjustBalance = useCallback(async (id, delta) => {
    const updated = await api.adjustBalance(authedFetch, id, delta);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    return updated;
  }, [authedFetch]);

  return { users, loading, error, refresh, getOne, setRole, adjustBalance };
}
