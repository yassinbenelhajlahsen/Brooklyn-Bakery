import { apiAuthed } from '../lib/apiFetch.js';

export function previewPromo(authedFetch, code) {
  return apiAuthed(authedFetch, '/promo-codes/preview', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}
