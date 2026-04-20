import express from 'express';
import { createOrder, listMyOrders } from '../controllers/orderController.js';

const router = express.Router();

router.get('/', listMyOrders);
router.post('/', createOrder);

export default router;
