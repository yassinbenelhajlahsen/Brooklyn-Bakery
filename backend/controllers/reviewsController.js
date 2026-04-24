import { prisma } from '../lib/prisma.js';

export async function getProductReviews(req, res) {
  const reviews = await prisma.review.findMany({
    where: { productId: req.params.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      rating: true,
      text: true,
      createdAt: true,
      user: { select: { displayName: true } },
    },
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
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Review text is required.' });
  }

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
  if (existing) {
    return res.status(409).json({ error: 'You have already reviewed this product.' });
  }

  const review = await prisma.review.create({
    data: { productId, userId, rating: ratingInt, text: String(text).trim() },
    select: {
      id: true,
      rating: true,
      text: true,
      createdAt: true,
      user: { select: { displayName: true } },
    },
  });
  res.status(201).json(review);
}
