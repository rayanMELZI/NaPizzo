const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'en', created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
      langs TEXT NOT NULL, default_lang TEXT NOT NULL, config TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '', whatsapp TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT '$', hours TEXT NOT NULL,
      delivery INTEGER NOT NULL DEFAULT 1, delivery_fee REAL NOT NULL DEFAULT 0, min_order REAL NOT NULL DEFAULT 0,
      accepting INTEGER NOT NULL DEFAULT 1,
      plan TEXT NOT NULL DEFAULT 'trial', trial_ends INTEGER NOT NULL, paid_until INTEGER NOT NULL DEFAULT 0,
      card_last4 TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY, shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🍽️', pos INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY, shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL, descr TEXT NOT NULL DEFAULT '{}', price REAL NOT NULL, image TEXT NOT NULL DEFAULT '',
      available INTEGER NOT NULL DEFAULT 1, pos INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY, shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      number INTEGER NOT NULL, customer TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', lines TEXT NOT NULL, total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'new', created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_items_shop ON items(shop_id);
  `);
  return db;
}

module.exports = { open };
