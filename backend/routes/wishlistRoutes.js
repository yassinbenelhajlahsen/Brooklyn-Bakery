import express from 'express';
import {
    getWishlist,
    addWishlistItem,
    removeWishlistItem,
} from '../controllers/wishlistController.js';

const router = express.Router();

router.get('/', getWishlist);
router.put('/items/:productId', addWishlistItem);
router.delete('/items/:productId', removeWishlistItem);

export default router;
