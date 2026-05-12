CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "product_type" "product_type",
    "product_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "promo_codes_discount_percent_check" CHECK ("discount_percent" >= 1 AND "discount_percent" <= 100),
    CONSTRAINT "promo_codes_scope_check" CHECK ("scope" IN ('storewide', 'category', 'product')),
    CONSTRAINT "promo_codes_scope_target_check" CHECK (
        ("scope" = 'storewide' AND "product_type" IS NULL AND "product_id" IS NULL)
        OR ("scope" = 'category' AND "product_type" IS NOT NULL AND "product_id" IS NULL)
        OR ("scope" = 'product' AND "product_id" IS NOT NULL AND "product_type" IS NULL)
    )
);

CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX "promo_codes_active_idx" ON "promo_codes"("active");
CREATE INDEX "promo_codes_scope_idx" ON "promo_codes"("scope");

ALTER TABLE "promo_codes"
ADD CONSTRAINT "promo_codes_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders"
ADD COLUMN "discount_total" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "promo_code_text" TEXT,
ADD COLUMN "promo_code_id" UUID;

CREATE INDEX "orders_promo_code_id_idx" ON "orders"("promo_code_id");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_promo_code_id_fkey"
FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
