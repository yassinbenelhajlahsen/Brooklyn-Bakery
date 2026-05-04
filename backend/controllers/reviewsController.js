import { prisma } from '../lib/prisma.js';
import { findProductBySlug } from '../lib/slugUtils.js';

const REVIEW_SELECT = {
  id: true,
  userId: true,
  rating: true,
  text: true,
  createdAt: true,
  user: { select: { displayName: true } },
};

async function resolveProductId(slug) {
  const products = await prisma.product.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
  });
  return findProductBySlug(slug, products)?.id ?? null;
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

  const review = await prisma.review.create({
    data: { productId, userId, rating: ratingInt, text: trimmedText },
    select: REVIEW_SELECT,
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

  const review = await prisma.review.update({
    where: { productId_userId: { productId, userId } },
    data: { rating: ratingInt, text: trimmedText },
    select: REVIEW_SELECT,
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

  await prisma.review.delete({ where: { productId_userId: { productId, userId } } });
  res.status(204).end();
}
