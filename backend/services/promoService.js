import { httpError } from '../lib/httpError.js';

export const PROMO_SCOPES = new Set(['storewide', 'category', 'product']);

export function normalizePromoCode(code) {
    return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

export function validatePromoInput(input = {}) {
    const code = normalizePromoCode(input.code);
    const discountPercent = Number(input.discountPercent);
    const scope = typeof input.scope === 'string' ? input.scope : '';
    const productType = input.productType || null;
    const productId = input.productId || null;

    if (!code || code.length > 40 || !/^[A-Z0-9_-]+$/.test(code)) {
        throw httpError(400, 'Code must use letters, numbers, underscores, or dashes.');
    }
    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
        throw httpError(400, 'Discount percent must be an integer from 1 to 100.');
    }
    if (!PROMO_SCOPES.has(scope)) {
        throw httpError(400, 'Scope must be storewide, category, or product.');
    }
    if (scope === 'storewide' && (productType || productId)) {
        throw httpError(400, 'Storewide codes cannot target a product or category.');
    }
    if (scope === 'category' && (!productType || productId)) {
        throw httpError(400, 'Category codes must target one category only.');
    }
    if (scope === 'product' && (!productId || productType)) {
        throw httpError(400, 'Product codes must target one product only.');
    }

    return {
        code,
        discountPercent,
        scope,
        productType: scope === 'category' ? productType : null,
        productId: scope === 'product' ? productId : null,
    };
}

export function getPromoApplicableSubtotal(cartItems, promo) {
    return cartItems.reduce((sum, ci) => {
        const product = ci.product;
        const lineTotal = ci.quantity * product.price;
        if (promo.scope === 'storewide') return sum + lineTotal;
        if (promo.scope === 'category' && product.type === promo.productType) return sum + lineTotal;
        if (promo.scope === 'product' && product.id === promo.productId) return sum + lineTotal;
        return sum;
    }, 0);
}

export function computePromoDiscount(cartItems, promo) {
    if (!promo) return { discountTotal: 0, applicableSubtotal: 0 };
    const applicableSubtotal = getPromoApplicableSubtotal(cartItems, promo);
    // Points are integers, so percentage discounts always round down to whole points.
    const discountTotal = Math.floor((applicableSubtotal * promo.discountPercent) / 100);
    return { discountTotal, applicableSubtotal };
}

export function formatPromo(promo) {
    if (!promo) return null;
    return {
        id: promo.id,
        code: promo.code,
        discountPercent: promo.discountPercent,
        scope: promo.scope,
        productType: promo.productType,
        productId: promo.productId,
        product: promo.product ?? null,
        orderCount: promo._count?.orders ?? 0,
        active: promo.active,
        createdAt: promo.createdAt,
        updatedAt: promo.updatedAt,
    };
}
