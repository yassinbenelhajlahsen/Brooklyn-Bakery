# Addresses — Design

## Purpose

Let users save shipping addresses to their account, manage them from `/me`, and pick one at checkout. Each order captures a snapshot of the chosen address so order history remains truthful if the user later edits or deletes that saved address. Admins can see the shipping address on each order.

## Scope

- New `addresses` table, owned per-user
- CRUD endpoints under `/api/me/addresses`
- Address selector on the checkout page with inline add / edit / delete, required before placing an order
- Six snapshot columns on `orders` populated at checkout
- Admin `OrderDetailDrawer` displays the snapshot

Out of scope: billing addresses, international format validation, default address flag, geocoding, address book sharing, a dedicated `/me` profile page (deferred).

## Data model

New Prisma model:

```
model Address {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  line1      String
  line2      String?
  city       String
  state      String
  postalCode String   @map("postal_code")
  country    String
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("addresses")
}
```

`User` gets a back-relation `addresses Address[]`.

`Order` gains six snapshot columns, all nullable in the DB to keep the migration backfill-free; the API requires them on new orders:

```
shippingLine1      String? @map("shipping_line1")
shippingLine2      String? @map("shipping_line2")
shippingCity       String? @map("shipping_city")
shippingState      String? @map("shipping_state")
shippingPostalCode String? @map("shipping_postal_code")
shippingCountry    String? @map("shipping_country")
```

No FK from `orders` to `addresses`: the order owns its copy. Deleting an address never touches past orders.

## API

All endpoints require `requireAuth` and scope by `req.user.id`.

### Addresses

- `GET /api/me/addresses` → `200 [{ id, line1, line2, city, state, postalCode, country, createdAt }]`, ordered by `createdAt desc`.
- `POST /api/me/addresses` — body: all six fields (line2 optional). Trim strings; reject if any required field is empty. → `201 { ...address }`.
- `PATCH /api/me/addresses/:id` — partial update of the six fields. 404 if not found, 403 if owned by another user. → `200 { ...address }`.
- `DELETE /api/me/addresses/:id` — 404 if not found, 403 if owned by another user. → `204`.

### Orders

`POST /api/orders` body gains a required `addressId` string.

- 400 if `addressId` missing.
- Inside the existing transaction (after the `FOR UPDATE` balance lock), load the address by id. If not found or `userId !== req.user.id`, abort with 403.
- Write the six snapshot columns onto the new order row from the loaded address.

Order responses (user-facing and admin) include the six `shipping*` fields.

## Frontend

### Checkout page — address selector with inline management

Placed above the confirm-order button. This is the only surface for managing addresses in this iteration.

- **Zero addresses:** render the inline "Add an address" form. The confirm button is disabled until the first address is saved.
- **One or more:** radio-button list (line1 + city as the label, full address in small text below), first address preselected. Each row exposes Edit and Delete icon buttons. Edit swaps the row into an inline form; Delete uses an inline confirm (same pattern as review delete). An "Add new" button reveals the same inline form to append another address.

The selected `addressId` is sent with the order request. The confirm button is disabled while no address is selected. If the selected address is deleted, the selection falls back to the first remaining address, or to the add-form state if the list is empty.

### Admin `OrderDetailDrawer`

New "Shipping address" section rendering `shippingLine1`, optional `shippingLine2`, then `shippingCity, shippingState shippingPostalCode`, `shippingCountry`. If all six are null (legacy orders predating this feature), show "No address on file".

## Validation and errors

- All six fields trimmed; required fields reject empty strings with 400 and a field-specific message.
- Ownership checks return 403 (not 404) when the row exists but belongs to another user, matching the pattern used elsewhere in the app for authorization failures on known resources. 404 only when the row does not exist.
- `addressId` missing on order → 400. `addressId` not owned → 403. Address deleted between page load and order submit → 403 (treated as not-owned; UI should refetch and show an error toast).

## Tests (backend, `node:test`)

- Address CRUD happy path (create, list, update, delete).
- List returns only the caller's addresses.
- Update and delete by another user → 403.
- Update/delete of non-existent id → 404.
- Required-field validation on create and update.
- Order creation without `addressId` → 400.
- Order creation with another user's `addressId` → 403, no order row written.
- Order creation with valid `addressId` → order row persists with snapshot fields equal to the address at time of order.
- After a successful order, deleting the address leaves the order's snapshot columns unchanged.

Frontend has no test harness; covered by manual verification.

## Migration

Single Prisma migration:

1. `CREATE TABLE addresses (...)` with the columns above and the userId index.
2. `ALTER TABLE orders ADD COLUMN shipping_line1 text, ... shipping_country text` — all nullable.

No data backfill. Existing orders keep nulls and render "No address on file" in the admin drawer.

## Non-goals / deferred

- Default-address flag (`isDefault`). Users re-pick each order for now.
- Address labels ("Home", "Work").
- Postal code / country format validation.
- Soft-delete of addresses.
