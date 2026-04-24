import { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { placeOrder as placeOrderService } from '../services/orderService.js';

export function usePlaceOrder({ onSuccess } = {}) {
  const { authedFetch, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const placeOrder = async ({ addressId }) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await placeOrderService(authedFetch, { addressId });
      await refreshProfile();
      if (onSuccess) onSuccess(created);
    } catch (err) {
      console.error('placeOrder failed:', err);
      setError(err?.message ?? 'Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return { placeOrder, submitting, error };
}
