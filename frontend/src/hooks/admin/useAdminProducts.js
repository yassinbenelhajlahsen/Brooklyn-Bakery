import { useCallback, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth.js';
import { queryKeys } from '../../lib/queryKeys.js';
import * as api from '../../services/admin/adminProductsService.js';

const PAGE_SIZE = 10;

export function useAdminProducts() {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(true);
  const [sort, setSort] = useState('newest');

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminProductsAll() });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['product'] });
  }, [queryClient]);

  const query = useInfiniteQuery({
    queryKey: queryKeys.adminProducts({ includeArchived, sort }),
    queryFn: ({ pageParam }) =>
      api.listProducts(authedFetch, {
        includeArchived,
        sort,
        take: PAGE_SIZE,
        skip: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((acc, p) => acc + p.items.length, 0);
    },
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages.at(-1)?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (data) => api.createProduct(authedFetch, data),
    onSuccess: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.updateProduct(authedFetch, id, data),
    onSuccess: invalidateAll,
  });

  const archiveMutation = useMutation({
    mutationFn: (id) => api.archiveProduct(authedFetch, id),
    onSuccess: invalidateAll,
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id) => api.unarchiveProduct(authedFetch, id),
    onSuccess: invalidateAll,
  });

  const create = (data) => createMutation.mutateAsync(data);
  const update = (id, data) => updateMutation.mutateAsync({ id, data });
  const archive = (id) => archiveMutation.mutateAsync(id);
  const unarchive = (id) => unarchiveMutation.mutateAsync(id);

  return {
    items,
    total,
    hasMore: query.hasNextPage ?? false,
    includeArchived,
    setIncludeArchived,
    sort,
    setSort,
    loading: query.isLoading,
    fetching: query.isFetching && !query.isFetchingNextPage,
    loadingMore: query.isFetchingNextPage,
    error: query.error?.message ?? null,
    refresh: () => query.refetch(),
    loadMore: () => query.fetchNextPage(),
    create,
    update,
    archive,
    unarchive,
  };
}
