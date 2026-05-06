import express from 'express';
import {getProducts, getProduct} from '../controllers/productsController.js';
import {getProductReviews, createReview, updateReview, deleteReview} from '../controllers/reviewsController.js';
import {requireAuth} from '../middleware/requireAuth.js';
import {httpCache} from '../middleware/httpCache.js';

const router = express.Router();

const productsCache = httpCache({ maxAge: 60, swr: 300 });
const reviewsCache = httpCache({ maxAge: 30, swr: 120 });

router.get('/', productsCache, getProducts);
router.get('/:slug', productsCache, getProduct);
router.get('/:slug/reviews', reviewsCache, getProductReviews);
router.post('/:slug/reviews', requireAuth, createReview);
router.patch('/:slug/reviews', requireAuth, updateReview);
router.delete('/:slug/reviews', requireAuth, deleteReview);

export default router;