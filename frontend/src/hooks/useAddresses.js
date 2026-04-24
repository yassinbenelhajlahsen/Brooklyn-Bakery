import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import {
  fetchAddresses,
  createAddress as createAddressApi,
  updateAddress as updateAddressApi,
  deleteAddress as deleteAddressApi,
} from '../services/addressesService.js';

export function useAddresses() {
  const { authedFetch, user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchAddresses(authedFetch);
      setAddresses(list);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (input) => {
    const created = await createAddressApi(authedFetch, input);
    setAddresses((prev) => [created, ...prev]);
    return created;
  }, [authedFetch]);

  const update = useCallback(async (id, input) => {
    const updated = await updateAddressApi(authedFetch, id, input);
    setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, [authedFetch]);

  const remove = useCallback(async (id) => {
    await deleteAddressApi(authedFetch, id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }, [authedFetch]);

  return { addresses, loading, error, refresh, create, update, remove };
}
