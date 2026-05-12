import express from 'express';
import {
    createPromoCode,
    deletePromoCode,
    listPromoCodes,
    updatePromoCode,
} from '../controllers/adminPromoController.js';

const router = express.Router();

router.get('/', listPromoCodes);
router.post('/', createPromoCode);
router.patch('/:id', updatePromoCode);
router.delete('/:id', deletePromoCode);

export default router;
