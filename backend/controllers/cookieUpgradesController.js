import express from 'express';
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { normalizeAddressInput } from '../lib/address.js';
import { Prisma } from '@prisma/client';

const upgrades = {
    15 : "one_half_points",
    25 : "double_points",
    50 : "triple_points"
}

export const getUserPoints = async (req, res) => {

    const user = await prisma.user.findFirst({
        where: { id: req.params.id }
    });

    console.log(user);

    if(user)
        console.log(user.balance);

    res.json(user.balance);
};


export const applyUpgrades = async (req, res) => {

    const user = await prisma.user.findFirst({
        where: { id: req.params.id }
    });

    console.log(user);

    let highestUpgrade = ""

    for(const key in upgrades){
        if (user.balance >= key)
            highestUpgrade = upgrades[key]
   }

    console.log(highestUpgrade)

    res.json(highestUpgrade)

}


