export async function createOrder(req, res) {
    console.log(`[orders] user=${req.user.id} items=${JSON.stringify(req.body)}`);
    res.status(200).json({ ok: true, received: req.body });
}
