import { useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth.js';
import { queryKeys } from '../../lib/queryKeys.js';
import * as api from '../../services/admin/adminOrdersService.js';

const PAGE_SIZE = 10;

export function useAdminOrders() {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');

  const query = useInfiniteQuery({
    queryKey: queryKeys.adminOrders({ status }),
    queryFn: ({ pageParam }) =>
      api.listOrders(authedFetch, {
        take: PAGE_SIZE,
        skip: pageParam,
        ...(status ? { status } : {}),
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((acc, p) => acc + p.items.length, 0);
    },
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages.at(-1)?.total ?? 0;

  const transitionMutation = useMutation({
    mutationFn: ({ id, action, reason }) =>
      api.transitionOrder(authedFetch, id, action, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOrdersAll() });
    },
  });

  const transition = (id, action, reason) =>
    transitionMutation.mutateAsync({ id, action, reason });

  return {
    items,
    total,
    hasMore: query.hasNextPage ?? false,
    status,
    loading: query.isLoading,
    fetching: query.isFetching && !query.isFetchingNextPage,
    loadingMore: query.isFetchingNextPage,
    error: query.error?.message ?? null,
    refresh: () => query.refetch(),
    loadMore: () => query.fetchNextPage(),
    setStatus,
    transition,
  };
}
