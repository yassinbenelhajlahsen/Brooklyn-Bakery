import express from 'express';
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { normalizeAddressInput } from '../lib/address.js';


export const getUserPoints = async (req,res) =>{
//   const { user, profile, authedFetch, refreshProfile } = useAuth();

    console.log(req.params.id)
    console.log('hitting')
    // console.log(req.body)
    res.json({msg : 'hi'})
//   res.json({msg : req.user.id})
}