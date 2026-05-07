import { queryKeys } from './queryKeys.js';

export function invalidateReviewAggregates(queryClient, { productId, slug }) {
  if (productId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.reviewsById(productId) });
  }
  if (slug) {
    queryClient.invalidateQueries({ queryKey: queryKeys.reviewsBySlug(slug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.product(slug) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.adminProductsAll() });
  queryClient.invalidateQueries({ queryKey: ['products'] });
}
