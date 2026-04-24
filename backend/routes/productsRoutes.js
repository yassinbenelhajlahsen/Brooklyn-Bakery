import express from 'express';
import {getProducts, getProduct} from '../controllers/productsController.js';
import {getProductReviews, createReview} from '../controllers/reviewsController.js';
import {requireAuth} from '../middleware/requireAuth.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/:id', getProduct);
router.get('/:id/reviews', getProductReviews);
router.post('/:id/reviews', requireAuth, createReview);

export default router;