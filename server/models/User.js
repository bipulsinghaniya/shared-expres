const { query } = require('../database');

/**
 * Create a new user.
 * @param {string} name
 * @param {string} email
 * @param {string} passwordHash
 * @returns {Promise<Object>} The created user (without passwordHash)
 */
async function createUser(name, email, passwordHash) {
  const result = await query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
    [name, email, passwordHash]
  );
  return result.rows[0];
}

/**
 * Find a user by email. Returns the full row INCLUDING password_hash.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findByEmail(email) {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Find a user by ID. Returns the row WITHOUT password_hash.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const result = await query(
    'SELECT id, name, email, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find multiple users by IDs.
 * @param {number[]} ids
 * @returns {Promise<Object[]>}
 */
async function findByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const result = await query(
    'SELECT id, name, email FROM users WHERE id = ANY($1)',
    [ids]
  );
  return result.rows;
}

/**
 * Strip password_hash from a user row for safe JSON responses.
 * @param {Object} user
 * @returns {Object}
 */
function toJSON(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = { createUser, findByEmail, findById, findByIds, toJSON };
