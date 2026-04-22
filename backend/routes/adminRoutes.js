import express from 'express';
import { listAllOrders, getOrder, transitionOrder } from '../controllers/adminOrdersController.js';
import adminProductsRoutes from './adminProductsRoutes.js';

const router = express.Router();

router.get('/orders', listAllOrders);
router.get('/orders/:id', getOrder);
router.post('/orders/:id/transition', transitionOrder);

router.use('/products', adminProductsRoutes);

export default router;
