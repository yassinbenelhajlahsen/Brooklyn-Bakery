import { prisma } from '../lib/prisma.js';
import { parseProductSlug } from '../lib/slugUtils.js';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  type: true,
  price: true,
  stock: true,
  _count: { select: { reviews: true } },
};

async function withRatings(products) {
  const aggs = await prisma.review.groupBy({
    by: ['productId'],
    _avg: { rating: true },
  });
  const avgMap = Object.fromEntries(aggs.map(a => [a.productId, a._avg.rating]));
  return products.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    type: p.type,
    price: p.price,
    stock: p.stock,
    avgRating: avgMap[p.id] ?? null,
    reviewCount: p._count.reviews,
  }));
}

export async function getProducts(_req, res) {
  const products = await prisma.product.findMany({
    where: { archivedAt: null },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: PRODUCT_SELECT,
  });
  res.json({ items: await withRatings(products) });
}

export async function getProduct(req, res) {
  const id = parseProductSlug(req.params.slug);
  if (!id) return res.status(404).json({ error: 'Product not found.' });
  const product = await prisma.product.findFirst({
    where: { id, archivedAt: null },
    select: PRODUCT_SELECT,
  });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const [formatted] = await withRatings([product]);
  res.json(formatted);
}
