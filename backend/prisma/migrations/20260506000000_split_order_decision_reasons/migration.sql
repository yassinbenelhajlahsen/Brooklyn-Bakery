-- Split request_reason and decision_reason into cancel- and return-specific
-- columns so a single order can carry both a prior cancel-flow note and a
-- later return-flow note without one overwriting the other.

ALTER TABLE "orders" ADD COLUMN "cancel_request_reason"  TEXT;
ALTER TABLE "orders" ADD COLUMN "return_request_reason"  TEXT;
ALTER TABLE "orders" ADD COLUMN "cancel_decision_reason" TEXT;
ALTER TABLE "orders" ADD COLUMN "return_decision_reason" TEXT;

-- Backfill request_reason / decision_reason into the appropriate column based
-- on the order's current status. For status='delivered' the source is
-- ambiguous (cancel-denied-then-shipped-then-delivered, or return-denied);
-- default to cancel since that is the only path where these fields persist
-- forward across shipping/delivery in the legacy schema.
UPDATE "orders"
   SET "cancel_request_reason"  = "request_reason",
       "cancel_decision_reason" = "decision_reason"
 WHERE "status" IN ('confirmed', 'processing', 'cancel_requested', 'cancelled', 'shipped', 'delivered');

UPDATE "orders"
   SET "return_request_reason"  = "request_reason",
       "return_decision_reason" = "decision_reason"
 WHERE "status" IN ('return_requested', 'returned');

ALTER TABLE "orders" DROP COLUMN "request_reason";
ALTER TABLE "orders" DROP COLUMN "decision_reason";
