import { prisma } from '../lib/prisma.js';
import { buildProductWhere, normalizeSearch, scoreProductMatch } from '../lib/products.js';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  type: true,
  price: true,
  stock: true,
  avgRating: true,
  reviewCount: true,
  createdAt: true,
};

export async function getProducts(req, res) {
  const search = normalizeSearch(req.query.search);
  const products = await prisma.product.findMany({
    where: buildProductWhere(search),
    orderBy: search ? undefined : [{ type: 'asc' }, { name: 'asc' }],
    select: PRODUCT_SELECT,
  });
  const items = search
    ? products.map(p => ({ ...p, score: scoreProductMatch(p, search) }))
    : products;
  res.json({ items });
}

export async function getProduct(req, res) {
  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, archivedAt: null },
    select: PRODUCT_SELECT,
  });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
}
