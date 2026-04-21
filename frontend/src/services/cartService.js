import { toHydratedCart } from '../lib/cart.js';

export async function mergeAndHydrateCart(authedFetch, localCart) {
  const payload = Object.values(localCart || {}).map(({ item, qty }) => ({
    productId: item.id,
    quantity: qty,
  }));
  const res = await authedFetch('/cart/merge', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return toHydratedCart(body.items);
}

export async function fetchServerCart(authedFetch) {
  try {
    const res = await authedFetch('/cart');
    if (!res.ok) return null;
    const body = await res.json();
    return toHydratedCart(body.items);
  } catch {
    return null;
  }
}

export async function syncCartItem(authedFetch, productId, quantity) {
  try {
    await authedFetch(`/cart/items/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
  } catch {
    // best-effort sync; surface via UI if it matters later
  }
}

export async function clearServerCart(authedFetch) {
  try {
    await authedFetch('/cart', { method: 'DELETE' });
  } catch {
    // best-effort clear
  }
}
