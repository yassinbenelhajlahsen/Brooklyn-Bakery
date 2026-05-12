export class PlaceOrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function placeOrder(authedFetch, { addressId, promoCode }) {
  const res = await authedFetch('/orders', {
    method: 'POST',
    body: JSON.stringify({ addressId, promoCode }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      res.status === 402
        ? 'Not enough points to complete this order.'
        : res.status === 400
          ? (body.error ?? 'Your cart is empty.')
          : res.status === 403
            ? 'That address is not available. Pick another.'
            : (body.error ?? 'Something went wrong. Please try again.');
    throw new PlaceOrderError(res.status, message);
  }
  return res.json();
}

export async function fetchMyOrders(authedFetch, { take = 10, skip = 0 } = {}) {
  const params = new URLSearchParams({ take: String(take), skip: String(skip) });
  const res = await authedFetch(`/orders?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not load your order history.');
  }
  const body = await res.json();
  return {
    items: body.items ?? [],
    total: body.total ?? 0,
    hasMore: body.hasMore ?? false,
  };
}

export async function updateOrderAddress(authedFetch, orderId, addressId) {
  const res = await authedFetch(`/orders/${orderId}/address`, {
    method: 'PATCH',
    body: JSON.stringify({ addressId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      res.status === 409
        ? (body.error ?? 'Address cannot be edited after we have started processing.')
        : res.status === 403 || res.status === 404
          ? 'That address is not available.'
          : (body.error ?? 'Could not update address.');
    throw new Error(message);
  }
  return res.json();
}

export async function userCancelOrder(authedFetch, orderId, reason) {
  const res = await authedFetch(`/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Cancel failed');
  }
  return res.json();
}

export async function userReturnOrder(authedFetch, orderId, reason) {
  const res = await authedFetch(`/orders/${orderId}/return`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Return request failed');
  }
  return res.json();
}
