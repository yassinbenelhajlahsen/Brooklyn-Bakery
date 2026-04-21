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
