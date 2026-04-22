export async function listUsers(authedFetch) {
  const res = await authedFetch('/admin/users');
  if (!res.ok) throw new Error('Failed to load users');
  const body = await res.json();
  return body.users ?? [];
}

export async function getUser(authedFetch, id) {
  const res = await authedFetch(`/admin/users/${id}`);
  if (!res.ok) throw new Error('Failed to load user');
  return res.json();
}

export async function updateRole(authedFetch, id, role) {
  const res = await authedFetch(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Role update failed');
  }
  return res.json();
}

export async function adjustBalance(authedFetch, id, delta) {
  const res = await authedFetch(`/admin/users/${id}/balance`, {
    method: 'POST',
    body: JSON.stringify({ delta }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Balance adjustment failed');
  }
  return res.json();
}
