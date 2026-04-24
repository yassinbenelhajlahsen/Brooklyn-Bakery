export class PlaceOrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function placeOrder(authedFetch, { addressId }) {
  const res = await authedFetch('/orders', {
    method: 'POST',
    body: JSON.stringify({ addressId }),
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

export async function fetchMyOrders(authedFetch) {
  const res = await authedFetch('/orders');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not load your order history.');
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
