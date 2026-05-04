import express from 'express';
import { getMe, updateMe, flushClicks } from '../controllers/meController.js';
import addressesRoutes from './addressesRoutes.js';

const router = express.Router();

router.get('/', getMe);
router.patch('/', updateMe);
router.post('/clicks', flushClicks);
router.use('/addresses', addressesRoutes);

export default router;
