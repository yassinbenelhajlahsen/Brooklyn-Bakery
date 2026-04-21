-- AlterTable
ALTER TABLE "products" ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0;

-- Integer CHECK constraint (not representable in Prisma schema)
ALTER TABLE "products" ADD CONSTRAINT products_stock_nonneg CHECK ("stock" >= 0);
