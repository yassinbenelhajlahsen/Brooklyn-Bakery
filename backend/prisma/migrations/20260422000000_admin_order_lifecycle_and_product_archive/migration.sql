-- Add new order status enum values
ALTER TYPE "order_status" ADD VALUE 'processing' BEFORE 'cancelled';
ALTER TYPE "order_status" ADD VALUE 'shipped' BEFORE 'cancelled';
ALTER TYPE "order_status" ADD VALUE 'delivered' BEFORE 'cancelled';
ALTER TYPE "order_status" ADD VALUE 'cancel_requested' BEFORE 'cancelled';
ALTER TYPE "order_status" ADD VALUE 'return_requested' AFTER 'cancelled';
ALTER TYPE "order_status" ADD VALUE 'returned' AFTER 'return_requested';

-- Add archived_at to products table
ALTER TABLE "products" ADD COLUMN "archived_at" TIMESTAMPTZ(6);

-- Add new fields to orders table
ALTER TABLE "orders" ADD COLUMN "delivered_at"    TIMESTAMPTZ(6);
ALTER TABLE "orders" ADD COLUMN "request_reason"  TEXT;
ALTER TABLE "orders" ADD COLUMN "decision_reason" TEXT;
