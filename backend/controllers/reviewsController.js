import { prisma } from '../lib/prisma.js';

const REVIEW_SELECT = {
  id: true,
  userId: true,
  rating: true,
  text: true,
  createdAt: true,
  user: { select: { displayName: true } },
};

export async function getProductReviews(req, res) {
  const reviews = await prisma.review.findMany({
    where: { productId: req.params.id },
    orderBy: { createdAt: 'desc' },
    select: REVIEW_SELECT,
  });
  res.json({ reviews });
}

export async function createReview(req, res) {
  const { rating, text } = req.body;
  const productId = req.params.id;
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

export async function deleteReview(req, res) {
  const productId = req.params.id;
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
