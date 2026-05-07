import express from 'express';
import {getProducts, getProduct} from '../controllers/productsController.js';
import {getProductReviews, createReview, updateReview, deleteReview} from '../controllers/reviewsController.js';
import {requireAuth} from '../middleware/requireAuth.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/:slug', getProduct);
router.get('/:slug/reviews', getProductReviews);
router.post('/:slug/reviews', requireAuth, createReview);
router.patch('/:slug/reviews', requireAuth, updateReview);
router.delete('/:slug/reviews', requireAuth, deleteReview);

export default router;
