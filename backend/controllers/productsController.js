import { prisma } from '../lib/prisma.js';

function formatProduct(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    type: p.type,
    price: p.price,
    stock: p.stock,
    avgRating: p._avg?.rating ?? null,
    reviewCount: p._count?.reviews ?? 0,
  };
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  type: true,
  price: true,
  stock: true,
  _avg: { select: { rating: true } },
  _count: { select: { reviews: true } },
};

export async function getProducts(_req, res) {
  const products = await prisma.product.findMany({
    where: { archivedAt: null },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: PRODUCT_SELECT,
  });
  res.json({ items: products.map(formatProduct) });
}

export async function getProduct(req, res) {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, archivedAt: null },
    select: PRODUCT_SELECT,
  });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(formatProduct(product));
}