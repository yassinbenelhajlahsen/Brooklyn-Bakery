export async function listOrders(authedFetch, { status, take = 10, skip = 0 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('take', String(take));
  params.set('skip', String(skip));
  const res = await authedFetch(`/admin/orders?${params}`);
  if (!res.ok) throw new Error('Failed to load orders');
  const body = await res.json();
  return {
    items: body.items ?? [],
    total: body.total ?? 0,
    hasMore: body.hasMore ?? false,
  };
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
