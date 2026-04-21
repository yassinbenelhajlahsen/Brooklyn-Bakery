import express from 'express';
import { getMe, flushClicks } from '../controllers/meController.js';

const router = express.Router();

router.get('/', getMe);
router.post('/clicks', flushClicks);

export default router;
