import express from 'express';
import { getUserPoints, applyUpgrades } from '../controllers/cookieUpgradesController.js';

const router = express.Router();

router.get('/getUserPoints', getUserPoints);
router.get('/applyUpgrades', applyUpgrades);

export default router;
