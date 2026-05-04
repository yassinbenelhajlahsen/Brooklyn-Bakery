import { prisma } from '../lib/prisma.js';
import { findProductBySlug } from '../lib/slugUtils.js';
import { buildProductWhere, normalizeSearch, scoreProductMatch } from '../lib/products.js';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  type: true,
  price: true,
  stock: true,
  createdAt: true,
  _count: { select: { reviews: true } },
};

async function withRatings(products, { search } = {}) {
  const aggs = await prisma.review.groupBy({
    by: ['productId'],
    _avg: { rating: true },
  });
  const avgMap = Object.fromEntries(aggs.map(a => [a.productId, a._avg.rating]));
  const q = normalizeSearch(search);
  return products.map(p => {
    const item = {
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      type: p.type,
      price: p.price,
      stock: p.stock,
      createdAt: p.createdAt,
      avgRating: avgMap[p.id] ?? null,
      reviewCount: p._count.reviews,
    };
    if (q) item.score = scoreProductMatch(p, q);
    return item;
  });
}

export async function getProducts(req, res) {
  const search = normalizeSearch(req.query.search);
  const products = await prisma.product.findMany({
    where: buildProductWhere(search),
    orderBy: search ? undefined : [{ type: 'asc' }, { name: 'asc' }],
    select: PRODUCT_SELECT,
  });
  res.json({ items: await withRatings(products, { search }) });
}

export async function getProduct(req, res) {
  const allProducts = await prisma.product.findMany({
    where: { archivedAt: null },
    select: PRODUCT_SELECT,
  });
  const product = findProductBySlug(req.params.slug, allProducts);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const [formatted] = await withRatings([product]);
  res.json(formatted);
}
