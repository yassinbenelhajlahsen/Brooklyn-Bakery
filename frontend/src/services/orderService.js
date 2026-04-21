export class PlaceOrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function placeOrder(authedFetch) {
  const res = await authedFetch('/orders', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      res.status === 402
        ? 'Not enough points to complete this order.'
        : res.status === 400
          ? 'Your cart is empty.'
          : (body.error ?? 'Something went wrong. Please try again.');
    throw new PlaceOrderError(res.status, message);
  }
  return res.json();
}
