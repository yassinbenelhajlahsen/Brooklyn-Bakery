export function computeCartSubtotal(cart) {
  return Object.values(cart).reduce(
    (sum, { item, qty }) => sum + item.price * qty,
    0,
  );
}

export function computeCartItemCount(cart) {
  return Object.values(cart).reduce((n, { qty }) => n + qty, 0);
}

export function toHydratedCart(items) {
  const hydrated = {};
  for (const row of items) {
    hydrated[row.productId] = { item: row.product, qty: row.quantity };
  }
  return hydrated;
}
