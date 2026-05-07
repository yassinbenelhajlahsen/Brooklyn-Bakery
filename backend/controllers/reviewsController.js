import { prisma } from '../lib/prisma.js';

const REVIEW_SELECT = {
  id: true,
  userId: true,
  rating: true,
  text: true,
  createdAt: true,
  user: { select: { displayName: true } },
};

async function resolveProductId(slug) {
  const product = await prisma.product.findFirst({
    where: { slug, archivedAt: null },
    select: { id: true },
  });
  return product?.id ?? null;
}

// Recompute denormalized rating cache from the reviews table.
// Called from the same transaction as the review write.
async function refreshProductRatingCache(tx, productId) {
  const agg = await tx.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      avgRating: agg._avg.rating,
      reviewCount: agg._count._all,
    },
  });
}

export async function getProductReviews(req, res) {
  const productId = await resolveProductId(req.params.slug);
  if (!productId) return res.status(404).json({ error: 'Product not found.' });
  const reviews = await prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    select: REVIEW_SELECT,
  });
  res.json({ reviews });
}

export async function createReview(req, res) {
  const { rating, text } = req.body;
  const productId = await resolveProductId(req.params.slug);
  if (!productId) return res.status(404).json({ error: 'Product not found.' });
  const userId = req.user.id;

  const ratingInt = parseInt(rating, 10);
  if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }
  const trimmedText = text ? String(text).trim() || null : null;

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (existing) {
    return res.status(409).json({ error: 'You have already reviewed this product.' });
  }

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: { productId, userId, rating: ratingInt, text: trimmedText },
      select: REVIEW_SELECT,
    });
    await refreshProductRatingCache(tx, productId);
    return created;
  });
  res.status(201).json(review);
}

export async function updateReview(req, res) {
  const { rating, text } = req.body;
  const productId = await resolveProductId(req.params.slug);
  if (!productId) return res.status(404).json({ error: 'Product not found.' });
  const userId = req.user.id;

  const ratingInt = parseInt(rating, 10);
  if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }
  const trimmedText = text ? String(text).trim() || null : null;

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Review not found.' });
  }

  const review = await prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { productId_userId: { productId, userId } },
      data: { rating: ratingInt, text: trimmedText },
      select: REVIEW_SELECT,
    });
    await refreshProductRatingCache(tx, productId);
    return updated;
  });
  res.json(review);
}

export async function deleteReview(req, res) {
  const productId = await resolveProductId(req.params.slug);
  if (!productId) return res.status(404).json({ error: 'Product not found.' });
  const userId = req.user.id;

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Review not found.' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { productId_userId: { productId, userId } } });
    await refreshProductRatingCache(tx, productId);
  });
  res.status(204).end();
}
