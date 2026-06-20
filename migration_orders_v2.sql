-- =============================================================
-- ORDER & PAYMENT REDESIGN MIGRATION (incremental, preserves data)
-- Adds: payment-confirmation workflow, made-to-order production stage,
--       online (Razorpay) + cash payments, immutable payment records,
--       admin notifications, invoice/slip numbering.
-- Run in your Neon SQL console.
-- =============================================================

-- 1) Convert status columns from ENUM to VARCHAR so we can add new states
ALTER TABLE orders ALTER COLUMN order_status DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN order_status TYPE VARCHAR(30) USING order_status::text;
ALTER TABLE orders ALTER COLUMN order_status SET DEFAULT 'pending';

ALTER TABLE orders ALTER COLUMN payment_status DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN payment_status TYPE VARCHAR(30) USING payment_status::text;
ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'unpaid';

DROP TYPE IF EXISTS order_status_enum;
DROP TYPE IF EXISTS payment_status_enum;

-- order_status values now:
--   awaiting_payment  (online order created, payment not completed yet)
--   pending           (cash order placed, waiting admin to confirm advance)
--   confirmed         (advance confirmed: cash approved OR online success)
--   in_production     (made-to-order item being manufactured)
--   ready_for_pickup  (product ready; customer can collect & pay balance)
--   delivered         (collected; final payment settled)
--   cancelled
--
-- payment_status values now:
--   unpaid | advance_paid | fully_paid | pending_after_delivery | refunded

-- 2) New order columns for the confirmation workflow & invoicing
ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_confirmed     BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_confirmed_at  TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_confirmed       BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_confirmed_at    TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_committed       BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_made_to_order      BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_no            VARCHAR(30);

-- 3) Existing orders were created under the old (already-placed) flow:
--    mark their advance as confirmed and stock as committed so they stay valid.
UPDATE orders SET advance_confirmed = TRUE, stock_committed = TRUE
WHERE advance_confirmed IS DISTINCT FROM TRUE;

UPDATE orders SET is_made_to_order = (all_items_available = FALSE);

-- 4) PAYMENTS — immutable record of every payment attempt/confirmation
CREATE TABLE IF NOT EXISTS payments (
    id                  SERIAL PRIMARY KEY,
    order_id            INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    payment_type        VARCHAR(10) NOT NULL CHECK (payment_type IN ('advance', 'final')),
    method              VARCHAR(10) NOT NULL CHECK (method IN ('cash', 'online')),
    amount              NUMERIC(10,2) NOT NULL,
    status              VARCHAR(15) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
    gateway             VARCHAR(20),                 -- razorpay | cash | simulated
    gateway_order_id    TEXT,
    gateway_payment_id  TEXT,
    gateway_signature   TEXT,
    confirmed_by_admin  BOOLEAN DEFAULT FALSE,
    confirmed_at        TIMESTAMP,
    slip_no             VARCHAR(30),
    created_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- Backfill a confirmed "advance" payment row for existing orders that had one
INSERT INTO payments (order_id, payment_type, method, amount, status, gateway, confirmed_by_admin, confirmed_at, slip_no, created_at)
SELECT o.id, 'advance',
       COALESCE(o.advance_payment_mode, 'cash'),
       o.advance_paid,
       'confirmed',
       COALESCE(o.advance_payment_mode, 'cash'),
       TRUE, o.created_at,
       'ADV-' || o.id || '-1',
       o.created_at
FROM orders o
WHERE o.advance_paid > 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.payment_type = 'advance');

-- Backfill final payments where already recorded
INSERT INTO payments (order_id, payment_type, method, amount, status, gateway, confirmed_by_admin, confirmed_at, slip_no, created_at)
SELECT o.id, 'final',
       COALESCE(o.final_payment_mode, 'cash'),
       o.final_paid,
       'confirmed',
       COALESCE(o.final_payment_mode, 'cash'),
       TRUE, COALESCE(o.actual_delivery_date, o.updated_at, o.created_at),
       'FIN-' || o.id || '-1',
       COALESCE(o.actual_delivery_date, o.updated_at, o.created_at)
FROM orders o
WHERE o.final_paid > 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.payment_type = 'final');

-- 5) NOTIFICATIONS — admin in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    type        VARCHAR(40) NOT NULL,   -- new_order | advance_pending | final_pending | order_cancelled | etc.
    title       TEXT NOT NULL,
    message     TEXT,
    order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at);

-- 6) Assign invoice numbers to already-delivered orders (optional, tidy)
UPDATE orders SET invoice_no = 'INV-' || TO_CHAR(COALESCE(actual_delivery_date, created_at), 'YYYY') || '-' || LPAD(id::text, 5, '0')
WHERE order_status = 'delivered' AND invoice_no IS NULL;
