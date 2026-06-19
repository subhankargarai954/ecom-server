-- =============================================================
-- BILINGUAL CONTENT MIGRATION (incremental — preserves existing data)
-- Adds optional Bengali fields for category & product names/descriptions.
-- When a *_bn field is empty, the customer app falls back to the default.
-- Run this in your Neon SQL console.
-- =============================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_bn VARCHAR(255);

ALTER TABLE products   ADD COLUMN IF NOT EXISTS name_bn        TEXT;
ALTER TABLE products   ADD COLUMN IF NOT EXISTS description_bn TEXT;

-- Optional: pre-fill Bengali names for the categories you already have.
-- (Edit / remove as you like — admin can also set these from the panel.)
UPDATE categories SET name_bn = 'পানীয়'   WHERE LOWER(name) = 'beverages'  AND name_bn IS NULL;
UPDATE categories SET name_bn = 'দুগ্ধজাত' WHERE LOWER(name) = 'dairy'      AND name_bn IS NULL;
UPDATE categories SET name_bn = 'ফল'       WHERE LOWER(name) = 'fruits'     AND name_bn IS NULL;
UPDATE categories SET name_bn = 'স্ন্যাকস' WHERE LOWER(name) = 'snacks'     AND name_bn IS NULL;
UPDATE categories SET name_bn = 'সবজি'     WHERE LOWER(name) = 'vegetables' AND name_bn IS NULL;
