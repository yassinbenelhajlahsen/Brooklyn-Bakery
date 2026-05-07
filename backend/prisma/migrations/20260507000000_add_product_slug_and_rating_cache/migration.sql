-- Add slug, avg_rating, review_count to products.
-- slug is nullable during backfill; locked NOT NULL + UNIQUE at the end.

ALTER TABLE "products" ADD COLUMN "slug" TEXT;
ALTER TABLE "products" ADD COLUMN "avg_rating" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN "review_count" INTEGER NOT NULL DEFAULT 0;

-- Backfill slug from name. When the same name appears more than once,
-- append the first 8 chars of the UUID so the slug stays unique.
-- This matches the rule used by frontend/src/lib/slugUtils.js::toProductSlug,
-- so existing in-the-wild URLs of the form "{name}-{uuid8}" continue to resolve.
WITH slugged AS (
  SELECT
    id,
    TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g')) AS base_slug
  FROM "products"
),
counted AS (
  SELECT id, base_slug, COUNT(*) OVER (PARTITION BY base_slug) AS slug_count
  FROM slugged
)
UPDATE "products" p
SET slug = CASE
  WHEN c.slug_count > 1 THEN c.base_slug || '-' || SUBSTRING(p.id::text, 1, 8)
  ELSE c.base_slug
END
FROM counted c
WHERE p.id = c.id;

-- Backfill rating cache from existing reviews.
UPDATE "products" p
SET
  avg_rating = sub.avg_rating,
  review_count = sub.review_count
FROM (
  SELECT
    product_id,
    AVG(rating)::double precision AS avg_rating,
    COUNT(*)::int AS review_count
  FROM "reviews"
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id;

ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
