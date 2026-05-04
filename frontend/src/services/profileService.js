export async function fetchProfile(authedFetch) {
  try {
    const res = await authedFetch('/me');
    if (!res.ok) return null;
    const body = await res.json();
    return body.user ?? null;
  } catch {
    return null;
  }
}

export async function updateMyProfile(authedFetch, { displayName }) {
  const res = await authedFetch('/me', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Failed to update profile');
  }
  const body = await res.json();
  return body.user ?? null;
}
