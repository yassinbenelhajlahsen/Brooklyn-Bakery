import express from 'express';
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { normalizeAddressInput } from '../lib/address.js';
import { Prisma } from '@prisma/client';


export const getUserPoints = async (req, res) => {

    const user = await prisma.user.findFirst({
        where: { id: req.params.id }
    });

    console.log(user);

    if(user)
        console.log(user.balance);

    res.json(user.balance);
};