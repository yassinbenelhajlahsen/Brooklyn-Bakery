import express from 'express';
import { getUserPoints } from '../controllers/cookieUpgradesController.js';

let router = express.Router()

router.get("/getUserPoints/:id", getUserPoints);

export default router;





