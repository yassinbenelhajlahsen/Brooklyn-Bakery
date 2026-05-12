export async function listPromoCodes(authedFetch) {
  const res = await authedFetch('/admin/promo-codes');
  if (!res.ok) throw new Error('Failed to load promo codes');
  const body = await res.json();
  return body.items ?? [];
}

export async function createPromoCode(authedFetch, data) {
  const res = await authedFetch('/admin/promo-codes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Create promo failed');
  }
  return res.json();
}

export async function updatePromoCode(authedFetch, id, data) {
  const res = await authedFetch(`/admin/promo-codes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Update promo failed');
  }
  return res.json();
}

export async function deletePromoCode(authedFetch, id) {
  const res = await authedFetch(`/admin/promo-codes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Delete promo failed');
  }
  return null;
}
