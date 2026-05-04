export function normalizeSearch(search) {
  return typeof search === 'string' ? search.trim() : '';
}

export function buildProductWhere(search) {
  const q = normalizeSearch(search);
  const base = { archivedAt: null };
  if (!q) return base;
  return {
    ...base,
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ],
  };
}

export function scoreProductMatch(product, search) {
  const q = normalizeSearch(search);
  if (!q) return null;
  const ql = q.toLowerCase();
  if (product.name.toLowerCase().includes(ql)) return 2;
  if (product.description.toLowerCase().includes(ql)) return 1;
  return null;
}
