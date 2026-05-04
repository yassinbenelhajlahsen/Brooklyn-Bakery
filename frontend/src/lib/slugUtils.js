export function toNameSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function toProductSlug(name, id, allProducts) {
  const nameSlug = toNameSlug(name);
  const hasDuplicate = allProducts.some(p => p.id !== id && toNameSlug(p.name) === nameSlug);
  return hasDuplicate ? `${nameSlug}-${id.slice(0, 8)}` : nameSlug;
}
