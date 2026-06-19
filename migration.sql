-- =============================================================
-- FULL DB MIGRATION SCRIPT
-- E-Commerce Platform: Customer Portal + Admin Portal
-- =============================================================
-- Run this in your Neon PostgreSQL console to reset and rebuild the schema.
-- WARNING: This drops all existing tables. Backup data first if needed.
-- =============================================================

-- Drop all existing tables (order matters due to FK constraints)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_img CASCADE;
DROP TABLE IF EXISTS category_img CASCADE;
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS category CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing enum types if any
DROP TYPE IF EXISTS order_status_enum CASCADE;
DROP TYPE IF EXISTS payment_status_enum CASCADE;

-- =============================================================
-- USERS
-- =============================================================
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(10)  UNIQUE NOT NULL,
    email       VARCHAR(255),
    hashed_password TEXT NOT NULL,
    address     TEXT,
    role        VARCHAR(10)  NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer', 'admin')),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- CATEGORIES
-- =============================================================
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    image_url   TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- PRODUCTS
-- =============================================================
CREATE TABLE products (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    base_price          NUMERIC(10,2) NOT NULL,
    discount_percent    NUMERIC(5,2) DEFAULT 0,
    description         TEXT,
    available_quantity  INTEGER NOT NULL DEFAULT 0,  -- used when product has NO variants
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- PRODUCT VARIANTS (optional — admin defines variant name freely)
-- e.g. "1kg", "500g", "Red XL", "Blue M"
-- When variants exist, stock is tracked per variant.
-- When no variants exist, products.available_quantity is used.
-- =============================================================
CREATE TABLE product_variants (
    id                  SERIAL PRIMARY KEY,
    product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_name        VARCHAR(100) NOT NULL,
    price_override      NUMERIC(10,2),         -- NULL = use product base_price
    available_quantity  INTEGER NOT NULL DEFAULT 0,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- PRODUCT IMAGES
-- =============================================================
CREATE TABLE product_images (
    id            SERIAL PRIMARY KEY,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url     TEXT NOT NULL,
    is_cover      BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- CART
-- =============================================================
CREATE TABLE cart (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id  INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, product_id, variant_id)
);

-- =============================================================
-- ORDERS
-- =============================================================
CREATE TYPE order_status_enum AS ENUM (
    'pending',           -- just placed, advance paid
    'confirmed',         -- admin confirmed (esp. for pre-orders)
    'ready_for_pickup',  -- all items available, customer can collect
    'delivered',         -- customer physically collected
    'cancelled'          -- cancelled by customer or admin
);

CREATE TYPE payment_status_enum AS ENUM (
    'advance_paid',            -- >=20% paid at order time
    'fully_paid',              -- 100% paid
    'pending_after_delivery',  -- delivery done but balance still owed
    'refunded'                 -- advance refunded on cancellation
);

CREATE TABLE orders (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id),

    -- Financials
    total_amount            NUMERIC(10,2) NOT NULL,
    advance_paid            NUMERIC(10,2) NOT NULL DEFAULT 0,
    final_paid              NUMERIC(10,2) NOT NULL DEFAULT 0,
    advance_payment_mode    VARCHAR(10) DEFAULT 'cash' CHECK (advance_payment_mode IN ('cash', 'online')),
    final_payment_mode      VARCHAR(10)               CHECK (final_payment_mode IN ('cash', 'online', 'mixed')),
    payment_status          payment_status_enum NOT NULL DEFAULT 'advance_paid',

    -- Availability flag (computed at order time)
    all_items_available     BOOLEAN NOT NULL DEFAULT TRUE,

    -- Delivery dates
    tentative_delivery_date DATE,      -- system-generated (+1 day) for pre-orders
    final_delivery_date     DATE,      -- admin confirms this
    actual_delivery_date    TIMESTAMP, -- when customer physically picked up

    -- Status
    order_status            order_status_enum NOT NULL DEFAULT 'pending',

    -- Notes
    admin_notes             TEXT,
    cancellation_reason     TEXT,

    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- ORDER ITEMS
-- =============================================================
CREATE TABLE order_items (
    id                      SERIAL PRIMARY KEY,
    order_id                INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id              INTEGER NOT NULL REFERENCES products(id),
    variant_id              INTEGER REFERENCES product_variants(id),
    quantity                INTEGER NOT NULL,
    unit_price              NUMERIC(10,2) NOT NULL,   -- price locked at order time
    discount_percent        NUMERIC(5,2) DEFAULT 0,   -- discount locked at order time
    was_available_at_order  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- INDEXES
-- =============================================================
CREATE INDEX idx_products_category    ON products(category_id);
CREATE INDEX idx_variants_product     ON product_variants(product_id);
CREATE INDEX idx_images_product       ON product_images(product_id);
CREATE INDEX idx_cart_user            ON cart(user_id);
CREATE INDEX idx_orders_user          ON orders(user_id);
CREATE INDEX idx_orders_status        ON orders(order_status);
CREATE INDEX idx_orders_payment       ON orders(payment_status);
CREATE INDEX idx_order_items_order    ON order_items(order_id);

-- =============================================================
-- ADMIN ACCOUNT
-- No admin is seeded here. After running this migration, create your
-- first admin via the setup endpoint (password is hashed by the server):
--
  curl -X POST http://localhost:5000/admin/api/auth/setup \
    -H "Content-Type: application/json" \
    -d '{"name":"Admin","phone":"9876543210","password":"Admin@123","setup_key":"my_S3cret_K3y_8f2kd9"}'
--
-- Then log in to the admin portal with that phone + password.
-- =============================================================
