export function toNameSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function findProductBySlug(slug, products) {
  // Try exact name slug match first
  const byName = products.find(p => toNameSlug(p.name) === slug);
  if (byName) return byName;

  // Fall back to UUID prefix match (slug ends with -{8hexchars})
  const prefixMatch = slug.match(/^(.*)-([0-9a-f]{8})$/i);
  if (prefixMatch) {
    const prefix = prefixMatch[2];
    return products.find(p => p.id.startsWith(prefix)) ?? null;
  }

  return null;
}
