export function toProductSlug(name, id) {
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const hex = id.replace(/-/g, '');
  return `${nameSlug}-${hex}`;
}

export function parseProductSlug(slug) {
  if (typeof slug !== 'string' || slug.length <= 32) return null;
  const hex = slug.slice(-32);
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
