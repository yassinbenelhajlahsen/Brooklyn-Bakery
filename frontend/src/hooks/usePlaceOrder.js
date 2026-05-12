import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth.js';
import { placeOrder as placeOrderService } from '../services/orderService.js';
import { invalidateOrderAggregates } from '../lib/invalidateOrderAggregates.js';

export function usePlaceOrder({ onSuccess, onError } = {}) {
  const { authedFetch, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ addressId, promoCode }) => placeOrderService(authedFetch, { addressId, promoCode }),
    onSuccess: async (created) => {
      invalidateOrderAggregates(queryClient, { affectsStock: true });
      await refreshProfile();
      if (onSuccess) onSuccess(created);
    },
    onError: (err) => {
      if (onError) onError(err);
    },
  });

  const placeOrder = (input) => mutation.mutate(input);

  return {
    placeOrder,
    submitting: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}
