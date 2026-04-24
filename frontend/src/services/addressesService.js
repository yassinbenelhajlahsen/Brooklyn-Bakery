export async function fetchAddresses(authedFetch) {
  const res = await authedFetch('/me/addresses');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not load addresses');
  }
  const { addresses } = await res.json();
  return addresses;
}

export async function createAddress(authedFetch, input) {
  const res = await authedFetch('/me/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not save address');
  }
  const { address } = await res.json();
  return address;
}

export async function updateAddress(authedFetch, id, input) {
  const res = await authedFetch(`/me/addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not update address');
  }
  const { address } = await res.json();
  return address;
}

export async function deleteAddress(authedFetch, id) {
  const res = await authedFetch(`/me/addresses/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not delete address');
  }
}
