export const queryKeys = {
  products: (filters = {}) => ['products', filters],
  product: (slug) => ['product', slug],
  reviewsBySlug: (slug) => ['reviews', 'slug', slug],
  reviewsById: (productId) => ['reviews', 'id', productId],
  orders: () => ['orders'],
  adminOrders: (filters = {}) => ['admin', 'orders', filters],
  adminOrdersAll: () => ['admin', 'orders'],
  adminProducts: (filters = {}) => ['admin', 'products', filters],
  adminProductsAll: () => ['admin', 'products'],
  adminUsers: () => ['admin', 'users'],
  adminUsersAll: () => ['admin', 'users'],
};
