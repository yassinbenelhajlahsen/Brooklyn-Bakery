export async function createOrder(req, res) {
    const lineItems = Object.keys(req.body ?? {}).length;
    console.log(`[orders] user=${req.user.id} lineItems=${lineItems}`);
    res.status(200).json({ ok: true, received: req.body });
}
