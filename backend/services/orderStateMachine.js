import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';

const RETURN_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Keyed by current status. Each inner key is an action name.
 * Fields:
 *   to            - target status
 *   actor         - 'user' | 'admin'
 *   refundPoints  - refund order.total to user.balance
 *   restoreStock  - increment product.stock for each order item
 *   setDeliveredAt- stamp order.deliveredAt = now()
 *   requiresReason- a text reason must be provided by the actor
 *   requiresWindow- enforce the 48h post-delivered window
 */
export const transitions = {
  confirmed: {
    cancel:        { to: 'cancelled',  actor: 'user',  refundPoints: true,  restoreStock: true,  requiresReason: false, reasonField: 'cancelRequestReason'  },
    setProcessing: { to: 'processing', actor: 'admin', refundPoints: false, restoreStock: false, requiresReason: false },
    forceCancel:   { to: 'cancelled',  actor: 'admin', refundPoints: true,  restoreStock: true,  requiresReason: true,  reasonField: 'cancelDecisionReason' },
  },
  processing: {
    requestCancel: { to: 'cancel_requested', actor: 'user',  refundPoints: false, restoreStock: false, requiresReason: false, reasonField: 'cancelRequestReason'  },
    setShipped:    { to: 'shipped',          actor: 'admin', refundPoints: false, restoreStock: false, requiresReason: false },
    forceCancel:   { to: 'cancelled',        actor: 'admin', refundPoints: true,  restoreStock: true,  requiresReason: true,  reasonField: 'cancelDecisionReason' },
  },
  cancel_requested: {
    approveCancel: { to: 'cancelled',  actor: 'admin', refundPoints: true,  restoreStock: true,  requiresReason: false, reasonField: 'cancelDecisionReason' },
    denyCancel:    { to: 'processing', actor: 'admin', refundPoints: false, restoreStock: false, requiresReason: true,  reasonField: 'cancelDecisionReason' },
  },
  shipped: {
    setDelivered:  { to: 'delivered', actor: 'admin', refundPoints: false, restoreStock: false, setDeliveredAt: true, requiresReason: false },
  },
  delivered: {
    requestReturn: { to: 'return_requested', actor: 'user',  refundPoints: false, restoreStock: false, requiresReason: false, requiresWindow: true, reasonField: 'returnRequestReason'  },
    forceReturn:   { to: 'returned',         actor: 'admin', refundPoints: true,  restoreStock: false, requiresReason: true,                        reasonField: 'returnDecisionReason' },
  },
  return_requested: {
    approveReturn: { to: 'returned',  actor: 'admin', refundPoints: true,  restoreStock: false, requiresReason: false, reasonField: 'returnDecisionReason' },
    denyReturn:    { to: 'delivered', actor: 'admin', refundPoints: false, restoreStock: false, requiresReason: true,  reasonField: 'returnDecisionReason' },
  },
  cancelled: {},
  returned: {},
};

export function resolveTransition(currentStatus, action, actor) {
  const fromEntries = transitions[currentStatus];
  if (!fromEntries) {
    throw httpError(409, `Invalid transition: unknown status "${currentStatus}"`);
  }
  const entry = fromEntries[action];
  if (!entry) {
    throw httpError(409, `Invalid transition: ${currentStatus} -> ${action}`);
  }
  if (entry.actor !== actor) {
    throw httpError(403, 'Forbidden');
  }
  return entry;
}

export function checkReturnWindow(deliveredAt, now = new Date()) {
  if (!deliveredAt) return false;
  const delivered = deliveredAt instanceof Date ? deliveredAt : new Date(deliveredAt);
  return (now.getTime() - delivered.getTime()) <= RETURN_WINDOW_MS;
}

export async function transition({ orderId, action, actor, reason }) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`
      SELECT id,
             user_id      AS "userId",
             status,
             total,
             delivered_at AS "deliveredAt"
      FROM orders
      WHERE id = ${orderId}::uuid
      FOR UPDATE
    `;
    if (locked.length === 0) throw httpError(404, 'Order not found');
    const order = locked[0];

    const entry = resolveTransition(order.status, action, actor);

    if (entry.requiresReason && !reason?.trim()) {
      throw httpError(400, 'Reason required');
    }
    if (entry.requiresWindow && !checkReturnWindow(order.deliveredAt)) {
      throw httpError(409, 'Return window has expired');
    }

    if (entry.refundPoints) {
      await tx.$queryRaw`SELECT balance FROM users WHERE id = ${order.userId}::uuid FOR UPDATE`;
      await tx.user.update({
        where: { id: order.userId },
        data: { balance: { increment: order.total } },
      });
    }

    if (entry.restoreStock) {
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    const data = { status: entry.to };
    if (entry.setDeliveredAt) data.deliveredAt = new Date();
    if (reason?.trim() && entry.reasonField) {
      data[entry.reasonField] = reason.trim();
    }

    return tx.order.update({
      where: { id: orderId },
      data,
      include: {
        items: { include: { product: { select: { name: true, imageUrl: true } } } },
        user:  { select: { id: true, displayName: true } },
      },
    });
  });
}
