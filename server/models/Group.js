const { query } = require('../database');

/**
 * Create a new group.
 * @param {string} name
 * @param {string} description
 * @param {number} createdBy - User ID of the creator
 * @returns {Promise<Object>}
 */
async function createGroup(name, description, createdBy) {
  const result = await query(
    'INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
    [name, description || '', createdBy]
  );
  return result.rows[0];
}

/**
 * Find a group by ID, with creator info joined.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const result = await query(
    `SELECT g.*, u.name AS created_by_name, u.email AS created_by_email
     FROM groups g
     JOIN users u ON u.id = g.created_by
     WHERE g.id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: {
      id: row.created_by,
      name: row.created_by_name,
      email: row.created_by_email,
    },
    createdAt: row.created_at,
  };
}

/**
 * Find multiple groups by IDs, with creator info joined, sorted by created_at DESC.
 * @param {number[]} ids
 * @returns {Promise<Object[]>}
 */
async function findByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const result = await query(
    `SELECT g.*, u.name AS created_by_name, u.email AS created_by_email
     FROM groups g
     JOIN users u ON u.id = g.created_by
     WHERE g.id = ANY($1)
     ORDER BY g.created_at DESC`,
    [ids]
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: {
      id: row.created_by,
      name: row.created_by_name,
      email: row.created_by_email,
    },
    createdAt: row.created_at,
  }));
}

/**
 * Update a group's name and/or description.
 * @param {number} id
 * @param {Object} updates - { name?, description? }
 * @returns {Promise<Object|null>}
 */
async function updateGroup(id, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }

  if (fields.length === 0) return findById(id);

  values.push(id);
  const result = await query(
    `UPDATE groups SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

module.exports = { createGroup, findById, findByIds, updateGroup };
