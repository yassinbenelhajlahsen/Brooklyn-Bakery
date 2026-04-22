import express from 'express';
import { createOrder, listMyOrders, userCancel, userReturn } from '../controllers/orderController.js';

const router = express.Router();

router.get('/', listMyOrders);
router.post('/', createOrder);
router.post('/:id/cancel', userCancel);
router.post('/:id/return', userReturn);

export default router;
