import express from 'express';
import {
    listAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
} from '../controllers/addressesController.js';

const router = express.Router();

router.get('/', listAddresses);
router.post('/', createAddress);
router.patch('/:id', updateAddress);
router.delete('/:id', deleteAddress);

export default router;
