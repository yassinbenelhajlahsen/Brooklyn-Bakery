import express from 'express';
import { getMe } from '../controllers/meController.js';

const router = express.Router();

router.get('/', getMe);

export default router;
