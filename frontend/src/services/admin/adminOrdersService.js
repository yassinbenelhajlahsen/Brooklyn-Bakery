export async function listOrders(authedFetch, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await authedFetch(`/admin/orders${qs}`);
  if (!res.ok) throw new Error('Failed to load orders');
  const body = await res.json();
  return body.orders ?? [];
}

export async function getOrder(authedFetch, id) {
  const res = await authedFetch(`/admin/orders/${id}`);
  if (!res.ok) throw new Error('Failed to load order');
  return res.json();
}

export async function transitionOrder(authedFetch, id, action, reason) {
  const res = await authedFetch(`/admin/orders/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Transition failed');
  }
  return res.json();
}
