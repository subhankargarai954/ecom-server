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

-- =============================================================
-- Pre-fill Bengali name + description for the existing 10 products.
-- Matched by id (see your current products table). Safe to re-run.
-- =============================================================
UPDATE products SET name_bn = 'তাজা লাল আপেল',        description_bn = 'তাজা ও রসালো লাল আপেল।'              WHERE id = 1;
UPDATE products SET name_bn = 'কলা',                   description_bn = 'তাজা পাকা কলা।'                      WHERE id = 2;
UPDATE products SET name_bn = 'আলু',                   description_bn = 'দৈনন্দিন রান্নার জন্য তাজা আলু।'      WHERE id = 3;
UPDATE products SET name_bn = 'টমেটো',                 description_bn = 'তাজা লাল টমেটো।'                     WHERE id = 4;
UPDATE products SET name_bn = 'ফুল ক্রিম দুধ',          description_bn = 'খাঁটি ফুল ক্রিম দুধ।'                  WHERE id = 5;
UPDATE products SET name_bn = 'পনির',                  description_bn = 'খাঁটি দুধ থেকে তৈরি তাজা পনির।'        WHERE id = 6;
UPDATE products SET name_bn = 'ক্লাসিক সল্টেড চিপস',    description_bn = 'মুচমুচে সল্টেড আলুর চিপস।'             WHERE id = 7;
UPDATE products SET name_bn = 'চকোলেট কুকিজ',          description_bn = 'মুচমুচে চকোলেট কুকিজ।'                WHERE id = 8;
UPDATE products SET name_bn = 'কমলার রস',              description_bn = 'সতেজ কমলার রস।'                      WHERE id = 9;
UPDATE products SET name_bn = 'কোল্ড কফি',             description_bn = 'পান করার জন্য প্রস্তুত কোল্ড কফি।'     WHERE id = 10;

-- If your product ids differ, you can match by name instead, e.g.:
-- UPDATE products SET name_bn = 'পনির' WHERE name = 'Paneer';
