export function mergeCartItems(existing, incoming) {
    const byId = new Map();
    for (const { productId, quantity } of existing) {
        if (productId && Number.isInteger(quantity) && quantity > 0) {
            byId.set(productId, quantity);
        }
    }
    for (const { productId, quantity } of incoming) {
        if (!productId || !Number.isInteger(quantity) || quantity <= 0) continue;
        byId.set(productId, Math.min(99, (byId.get(productId) ?? 0) + quantity));
    }
    return Array.from(byId, ([productId, quantity]) => ({ productId, quantity }));
}

export function computeCartTotal(items, priceByProductId) {
    let total = 0;
    for (const { productId, quantity } of items) {
        const price = priceByProductId[productId];
        if (price == null) {
            throw new Error(`missing price for product ${productId}`);
        }
        total += price * quantity;
    }
    return total;
}
