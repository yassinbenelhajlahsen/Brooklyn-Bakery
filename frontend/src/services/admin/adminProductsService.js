export async function listProducts(authedFetch, { includeArchived = false } = {}) {
  const qs = includeArchived ? '?includeArchived=true' : '';
  const res = await authedFetch(`/admin/products${qs}`);
  if (!res.ok) throw new Error('Failed to load products');
  const body = await res.json();
  return body.products ?? [];
}

export async function createProduct(authedFetch, data) {
  const res = await authedFetch('/admin/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Create failed');
  }
  return res.json();
}

export async function updateProduct(authedFetch, id, data) {
  const res = await authedFetch(`/admin/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Update failed');
  }
  return res.json();
}

export async function archiveProduct(authedFetch, id) {
  const res = await authedFetch(`/admin/products/${id}/archive`, { method: 'POST' });
  if (!res.ok) throw new Error('Archive failed');
  return res.json();
}

export async function unarchiveProduct(authedFetch, id) {
  const res = await authedFetch(`/admin/products/${id}/unarchive`, { method: 'POST' });
  if (!res.ok) throw new Error('Unarchive failed');
  return res.json();
}
