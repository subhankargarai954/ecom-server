-- =====================================================================
-- migration_messaging.sql
-- Adds the message_logs table that stores every SMS / WhatsApp
-- notification sent to a customer (order updates, payment receipts,
-- order completion). Run this in the Neon SQL console, then restart
-- the backend.
-- =====================================================================

CREATE TABLE IF NOT EXISTS message_logs (
    id            SERIAL PRIMARY KEY,
    order_id      INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    user_id       INTEGER REFERENCES users(id)  ON DELETE SET NULL,
    channel       VARCHAR(10)  NOT NULL,                 -- sms | whatsapp
    event         VARCHAR(40)  NOT NULL,                 -- order_placed, advance_confirmed, ...
    to_phone      VARCHAR(20),
    body          TEXT,
    media         TEXT,                                  -- JSON array of media URLs
    status        VARCHAR(20)  DEFAULT 'simulated',      -- sent | failed | simulated
    provider      VARCHAR(20),                           -- twilio | simulation
    provider_sid  VARCHAR(80),
    error         TEXT,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_order ON message_logs(order_id);
