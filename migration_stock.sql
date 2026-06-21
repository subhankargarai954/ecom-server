-- =====================================================================
-- migration_stock.sql
-- Stock model change: available_quantity now means PHYSICAL ON-HAND stock.
-- Reservations (confirmed-but-undelivered orders) are computed dynamically,
-- and on-hand is decremented at DELIVERY instead of at confirmation.
--
-- Under the OLD model, stock was decremented at confirmation for items that
-- were in stock at order time. This migration adds those quantities back for
-- orders that are STILL holding a reservation (confirmed / in_production /
-- ready_for_pickup), so available_quantity reflects true on-hand again.
-- Delivered orders are left as-is (their goods genuinely left).
--
-- Run once in the Neon SQL console, then restart the backend.
-- Safe to skip if you'd rather just re-enter correct stock counts by hand.
-- =====================================================================

-- Products (non-variant order items)
UPDATE products p SET available_quantity = p.available_quantity + s.qty
FROM (
    SELECT oi.product_id, SUM(oi.quantity) AS qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.variant_id IS NULL
      AND oi.was_available_at_order = TRUE
      AND o.stock_committed = TRUE
      AND o.order_status IN ('confirmed', 'in_production', 'ready_for_pickup')
    GROUP BY oi.product_id
) s
WHERE p.id = s.product_id;

-- Variants
UPDATE product_variants pv SET available_quantity = pv.available_quantity + s.qty
FROM (
    SELECT oi.variant_id, SUM(oi.quantity) AS qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.variant_id IS NOT NULL
      AND oi.was_available_at_order = TRUE
      AND o.stock_committed = TRUE
      AND o.order_status IN ('confirmed', 'in_production', 'ready_for_pickup')
    GROUP BY oi.variant_id
) s
WHERE pv.id = s.variant_id;
