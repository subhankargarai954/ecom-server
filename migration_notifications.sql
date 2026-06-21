-- =====================================================================
-- migration_notifications.sql
-- Adds audience + user_id to notifications so the same table can serve
-- both the admin bell (audience='admin') and a new customer bell
-- (audience='customer', user_id = the customer). Existing rows are admin
-- notifications. Run once in the Neon SQL console, then restart the backend.
-- =====================================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS audience VARCHAR(10) NOT NULL DEFAULT 'admin';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience, user_id, is_read);
