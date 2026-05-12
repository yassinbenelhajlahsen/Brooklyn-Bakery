import { prisma } from '../lib/prisma.js';
import { computeCartTotal } from '../lib/cart.js';
import { httpError } from '../lib/httpError.js';
import {
    computePromoDiscount,
    formatPromo,
    normalizePromoCode,
} from '../services/promoService.js';

const PRODUCT_SELECT = { id: true, name: true, price: true, type: true };

export async function previewPromo(req, res, next) {
    try {
        const code = normalizePromoCode(req.body?.code);
        if (!code) throw httpError(400, 'Promo code is required.');

        const cartItems = await prisma.cartItem.findMany({
            where: { userId: req.user.id },
            include: { product: { select: PRODUCT_SELECT } },
        });
        if (cartItems.length === 0) throw httpError(400, 'Cart is empty.');

        const promo = await prisma.promoCode.findUnique({
            where: { code },
            include: { product: { select: { id: true, name: true } } },
        });
        if (!promo) throw httpError(404, 'Promo code was not found.');
        if (!promo.active) throw httpError(410, 'Promo code has expired.');

        const { discountTotal, applicableSubtotal } = computePromoDiscount(cartItems, promo);
        if (applicableSubtotal <= 0 || discountTotal <= 0) {
            throw httpError(409, 'Promo code does not apply to items in your cart.');
        }

        const prices = Object.fromEntries(cartItems.map((ci) => [ci.product.id, ci.product.price]));
        const subtotal = computeCartTotal(
            cartItems.map((ci) => ({ productId: ci.product.id, quantity: ci.quantity })),
            prices,
        );

        res.json({
            promo: formatPromo(promo),
            subtotal,
            applicableSubtotal,
            discountTotal,
            total: Math.max(0, subtotal - discountTotal),
        });
    } catch (err) {
        next(err);
    }
}
