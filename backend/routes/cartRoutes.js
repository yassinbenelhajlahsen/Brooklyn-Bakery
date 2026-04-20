import express from 'express';
import {
    getCart,
    upsertCartItem,
    deleteCart,
    mergeCart,
} from '../controllers/cartController.js';

const router = express.Router();

router.get('/', getCart);
router.delete('/', deleteCart);
router.post('/merge', mergeCart);
router.put('/items/:productId', upsertCartItem);

export default router;
