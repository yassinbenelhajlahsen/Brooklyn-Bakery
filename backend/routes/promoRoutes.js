import express from 'express';
import { previewPromo } from '../controllers/promoController.js';

const router = express.Router();

router.post('/preview', previewPromo);

export default router;
