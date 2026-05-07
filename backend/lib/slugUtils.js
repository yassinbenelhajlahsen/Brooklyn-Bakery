export function toNameSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function disambiguateSlug(baseSlug, id) {
  return `${baseSlug}-${id.slice(0, 8)}`;
}
