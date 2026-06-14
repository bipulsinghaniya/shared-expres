const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

/**
 * Run a SQL query using the connection pool.
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Initialise the database schema (CREATE TABLE IF NOT EXISTS).
 * Safe to call on every server start.
 */
async function initializeDatabase() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      join_date TIMESTAMP NOT NULL,
      leave_date TIMESTAMP,
      added_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      amount_in_inr REAL NOT NULL,
      exchange_rate_used REAL DEFAULT 1,
      date TIMESTAMP NOT NULL,
      paid_by INTEGER NOT NULL REFERENCES users(id),
      split_type TEXT NOT NULL CHECK(split_type IN ('EQUAL','EXACT','PERCENTAGE','SHARES')),
      is_settlement BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      import_row_index INTEGER,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS expense_splits (
      id SERIAL PRIMARY KEY,
      expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_logs (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id),
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      file_name TEXT NOT NULL,
      imported_at TIMESTAMP DEFAULT NOW(),
      total_rows INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      anomalies JSONB DEFAULT '[]',
      parsed_rows JSONB DEFAULT '[]',
      is_confirmed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id, is_deleted, date);
    CREATE INDEX IF NOT EXISTS idx_expenses_paidby ON expenses(group_id, paid_by);
    CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
  `;

  await pool.query(schema);
  console.log('✅ Database schema initialized');
}

module.exports = { pool, query, initializeDatabase };
