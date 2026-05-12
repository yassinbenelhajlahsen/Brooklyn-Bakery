import { apiAuthed } from '../lib/apiFetch.js';

export function fetchWishlist(authedFetch) {
  return apiAuthed(authedFetch, '/wishlist');
}

export function addWishlistItem(authedFetch, productId) {
  return apiAuthed(authedFetch, `/wishlist/items/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({}),
  });
}

export function removeWishlistItem(authedFetch, productId) {
  return apiAuthed(authedFetch, `/wishlist/items/${productId}`, {
    method: 'DELETE',
  });
}
