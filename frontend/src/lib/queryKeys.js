export const queryKeys = {
  products: (filters = {}) => ['products', filters],
  product: (slug) => ['product', slug],
  reviewsBySlug: (slug) => ['reviews', 'slug', slug],
  reviewsById: (productId) => ['reviews', 'id', productId],
  orders: () => ['orders'],
};
