import express from 'express';
import { getUserPoints,applyUpgrades } from '../controllers/cookieUpgradesController.js';




let router = express.Router()

router.get("/getUserPoints/:id", getUserPoints);

router.get("/applyUpgrades/:id", applyUpgrades );

export default router;





