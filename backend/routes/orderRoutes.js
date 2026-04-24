import express from 'express';
import { createOrder, listMyOrders, userCancel, userReturn, updateOrderAddress } from '../controllers/orderController.js';

const router = express.Router();

router.get('/', listMyOrders);
router.post('/', createOrder);
router.patch('/:id/address', updateOrderAddress);
router.post('/:id/cancel', userCancel);
router.post('/:id/return', userReturn);

export default router;
