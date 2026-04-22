import express from 'express';
import {
    listProducts, createProduct, updateProduct, archiveProduct, unarchiveProduct,
} from '../controllers/adminProductsController.js';

const router = express.Router();

router.get('/', listProducts);
router.post('/', createProduct);
router.patch('/:id', updateProduct);
router.post('/:id/archive', archiveProduct);
router.post('/:id/unarchive', unarchiveProduct);

export default router;
