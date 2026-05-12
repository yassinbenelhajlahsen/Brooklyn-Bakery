import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth.js';
import { queryKeys } from '../../lib/queryKeys.js';
import * as api from '../../services/admin/adminPromoService.js';

export function useAdminPromoCodes() {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.adminPromoCodes(),
    queryFn: () => api.listPromoCodes(authedFetch),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminPromoCodes() });
  };

  const createMutation = useMutation({
    mutationFn: (data) => api.createPromoCode(authedFetch, data),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.updatePromoCode(authedFetch, id, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deletePromoCode(authedFetch, id),
    onSuccess: invalidate,
  });

  return {
    items: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? createMutation.error?.message ?? updateMutation.error?.message ?? deleteMutation.error?.message ?? null,
    create: (data) => createMutation.mutateAsync(data),
    update: (id, data) => updateMutation.mutateAsync({ id, data }),
    remove: (id) => deleteMutation.mutateAsync(id),
    creating: createMutation.isPending,
    updatingId: updateMutation.variables?.id ?? null,
    updating: updateMutation.isPending,
    deletingId: deleteMutation.variables ?? null,
    deleting: deleteMutation.isPending,
  };
}
