import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth.js';
import { queryKeys } from '../../lib/queryKeys.js';
import * as api from '../../services/admin/adminUsersService.js';

const PAGE_SIZE = 10;

export function useAdminUsers() {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.adminUsers(),
    queryFn: ({ pageParam }) =>
      api.listUsers(authedFetch, { take: PAGE_SIZE, skip: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((acc, p) => acc + p.items.length, 0);
    },
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages.at(-1)?.total ?? 0;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminUsersAll() });
  };

  const setRoleMutation = useMutation({
    mutationFn: ({ id, role }) => api.updateRole(authedFetch, id, role),
    onSuccess: invalidateAll,
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: ({ id, delta }) => api.adjustBalance(authedFetch, id, delta),
    onSuccess: invalidateAll,
  });

  const getOne = (id) => api.getUser(authedFetch, id);
  const setRole = (id, role) => setRoleMutation.mutateAsync({ id, role });
  const adjustBalance = (id, delta) =>
    adjustBalanceMutation.mutateAsync({ id, delta });

  return {
    items,
    total,
    hasMore: query.hasNextPage ?? false,
    loading: query.isLoading,
    fetching: query.isFetching && !query.isFetchingNextPage,
    loadingMore: query.isFetchingNextPage,
    error: query.error?.message ?? null,
    refresh: () => query.refetch(),
    loadMore: () => query.fetchNextPage(),
    getOne,
    setRole,
    adjustBalance,
  };
}
