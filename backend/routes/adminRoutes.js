import express from 'express';
import { listAllOrders, getOrder, transitionOrder } from '../controllers/adminOrdersController.js';

const router = express.Router();

router.get('/orders', listAllOrders);
router.get('/orders/:id', getOrder);
router.post('/orders/:id/transition', transitionOrder);

export default router;
