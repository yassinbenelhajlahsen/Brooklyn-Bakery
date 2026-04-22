import express from 'express';
import {
    listUsers, getUser, updateRole, adjustBalance,
} from '../controllers/adminUsersController.js';

const router = express.Router();

router.get('/', listUsers);
router.get('/:id', getUser);
router.patch('/:id/role', updateRole);
router.post('/:id/balance', adjustBalance);

export default router;
