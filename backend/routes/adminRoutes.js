import express from 'express';
import { listAllOrders, cancelOrder } from '../controllers/adminOrdersController.js';

const router = express.Router();

router.get('/orders', listAllOrders);
router.patch('/orders/:id/cancel', cancelOrder);

export default router;
