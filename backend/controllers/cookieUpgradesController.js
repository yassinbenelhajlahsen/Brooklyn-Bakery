import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';

const upgrades = {
    15: 'one_half_points',
    25: 'double_points',
    50: 'triple_points',
};

export const getUserPoints = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { balance: true },
        });
        if (!user) throw httpError(404, 'Profile not found');
        res.json(user.balance);
    } catch (err) {
        next(err);
    }
};

export const applyUpgrades = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { balance: true },
        });
        if (!user) throw httpError(404, 'Profile not found');

        let highestUpgrade = '';
        for (const key of Object.keys(upgrades)) {
            if (user.balance >= Number(key)) highestUpgrade = upgrades[key];
        }
        res.json(highestUpgrade);
    } catch (err) {
        next(err);
    }
};
