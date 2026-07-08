const { query } = require('../database');

/**
 * Create a new group member.
 * @param {Object} data - { groupId, userId, joinDate, leaveDate?, addedBy }
 * @returns {Promise<Object>}
 */
async function create(data) {
  const result = await query(
    `INSERT INTO group_members (group_id, user_id, join_date, leave_date, added_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.groupId, data.userId, data.joinDate, data.leaveDate || null, data.addedBy]
  );
  return result.rows[0];
}

/**
 * Find a membership record by group and user.
 * @param {number} groupId
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function findByGroupAndUser(groupId, userId) {
  const result = await query(
    `SELECT gm.*, u.name AS user_name, u.email AS user_email
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 AND gm.user_id = $2`,
    [groupId, userId]
  );
  if (result.rows.length === 0) return null;
  return formatMember(result.rows[0]);
}

/**
 * Find a membership record by its ID.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findMemberById(id) {
  const result = await query(
    `SELECT gm.*, u.name AS user_name, u.email AS user_email
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return formatMember(result.rows[0]);
}

/**
 * Get all members who were active on a given date.
 * A member is active if: joinDate <= date AND (leaveDate is null OR leaveDate >= date)
 * @param {number} groupId
 * @param {Date} date
 * @returns {Promise<Object[]>}
 */
async function getActiveMembers(groupId, date) {
  const queryDate = new Date(date);
  const result = await query(
    `SELECT gm.*, u.name AS user_name, u.email AS user_email
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
       AND gm.join_date <= $2
       AND (gm.leave_date IS NULL OR gm.leave_date >= $2)`,
    [groupId, queryDate]
  );
  return result.rows.map(formatMember);
}

/**
 * Get ALL members for a group (active + inactive), with user info.
 * @param {number} groupId
 * @returns {Promise<Object[]>}
 */
async function getAllMembers(groupId) {
  const result = await query(
    `SELECT DISTINCT ON (gm.user_id) gm.*, u.name AS user_name, u.email AS user_email
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.user_id, gm.join_date ASC`,
    [groupId]
  );
  return result.rows.map(formatMember);
}

/**
 * Count members in a group.
 * @param {number} groupId
 * @returns {Promise<number>}
 */
async function countByGroup(groupId) {
  const result = await query(
    'SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1',
    [groupId]
  );
  return result.rows[0].count;
}

/**
 * Update a member's join/leave dates.
 * @param {number} groupId
 * @param {number} userId
 * @param {Object} updates - { joinDate?, leaveDate? }
 * @returns {Promise<Object|null>}
 */
async function updateMember(groupId, userId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.joinDate !== undefined) {
    fields.push(`join_date = $${paramIndex++}`);
    values.push(new Date(updates.joinDate));
  }
  if (updates.leaveDate !== undefined) {
    fields.push(`leave_date = $${paramIndex++}`);
    values.push(updates.leaveDate ? new Date(updates.leaveDate) : null);
  }
  fields.push(`updated_at = NOW()`);

  if (fields.length === 1) return findByGroupAndUser(groupId, userId); // only updated_at

  values.push(groupId, userId);
  await query(
    `UPDATE group_members SET ${fields.join(', ')}
     WHERE group_id = $${paramIndex++} AND user_id = $${paramIndex}`,
    values
  );
  return findByGroupAndUser(groupId, userId);
}

/**
 * Find all group memberships for a user (returns group_id list).
 * @param {number} userId
 * @returns {Promise<number[]>}
 */
async function findGroupIdsByUser(userId) {
  const result = await query(
    'SELECT group_id FROM group_members WHERE user_id = $1',
    [userId]
  );
  return result.rows.map((r) => r.group_id);
}

/**
 * Delete all members in a group (for seeding/cleanup).
 * @param {number} groupId
 */
async function deleteByGroup(groupId) {
  await query('DELETE FROM group_members WHERE group_id = $1', [groupId]);
}

/**
 * Format a raw row into the shape expected by the rest of the app.
 * Mimics the Mongoose .populate('userId', 'name email') pattern.
 */
function formatMember(row) {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: {
      _id: row.user_id,
      id: row.user_id,
      name: row.user_name,
      email: row.user_email,
    },
    joinDate: row.join_date,
    leaveDate: row.leave_date,
    addedBy: row.added_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  create,
  findByGroupAndUser,
  findMemberById,
  getActiveMembers,
  getAllMembers,
  countByGroup,
  updateMember,
  findGroupIdsByUser,
  deleteByGroup,
  formatMember,
};
