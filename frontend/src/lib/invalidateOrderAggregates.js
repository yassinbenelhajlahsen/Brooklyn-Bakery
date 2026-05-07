import { queryKeys } from './queryKeys.js';

export function invalidateOrderAggregates(queryClient, { affectsStock = false } = {}) {
  queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
  queryClient.invalidateQueries({ queryKey: queryKeys.adminOrdersAll() });
  if (affectsStock) {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['product'] });
  }
}
