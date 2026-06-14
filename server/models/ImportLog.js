const { query } = require('../database');

/**
 * Format DB row to application object
 */
function formatImportLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id, // For backward compatibility with some frontend expectations
    groupId: row.group_id,
    uploadedBy: {
      id: row.uploaded_by,
      _id: row.uploaded_by,
      name: row.uploaded_by_name,
      email: row.uploaded_by_email,
    },
    fileName: row.file_name,
    importedAt: row.imported_at,
    totalRows: row.total_rows,
    successCount: row.success_count,
    errorCount: row.error_count,
    skippedCount: row.skipped_count,
    anomalies: row.anomalies || [], // Stored as JSONB
    parsedRows: row.parsed_rows || [], // Stored as JSONB
    isConfirmed: row.is_confirmed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new import log.
 * @param {Object} data 
 * @returns {Promise<Object>}
 */
async function create(data) {
  // Ensure anomalies and parsedRows have IDs since we aren't using Mongoose embedded docs
  const anomaliesWithIds = (data.anomalies || []).map((a, i) => ({
    ...a,
    _id: a._id || `anomaly_${Date.now()}_${i}` // Generate a fake ID for frontend tracking
  }));

  const result = await query(
    `INSERT INTO import_logs (
      group_id, uploaded_by, file_name, total_rows, success_count, 
      error_count, skipped_count, anomalies, parsed_rows, is_confirmed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      data.groupId,
      data.uploadedBy,
      data.fileName,
      data.totalRows || 0,
      data.successCount || 0,
      data.errorCount || 0,
      data.skippedCount || 0,
      JSON.stringify(anomaliesWithIds),
      JSON.stringify(data.parsedRows || []),
      data.isConfirmed || false
    ]
  );
  
  return findById(result.rows[0].id);
}

/**
 * Find import logs for a group.
 * @param {number} groupId 
 * @returns {Promise<Object[]>}
 */
async function findByGroup(groupId) {
  const result = await query(
    `SELECT i.*, u.name AS uploaded_by_name, u.email AS uploaded_by_email
     FROM import_logs i
     JOIN users u ON u.id = i.uploaded_by
     WHERE i.group_id = $1
     ORDER BY i.imported_at DESC`,
    [groupId]
  );
  return result.rows.map(formatImportLog);
}

/**
 * Find an import log by ID and group ID.
 * @param {number} id 
 * @param {number} groupId 
 * @returns {Promise<Object|null>}
 */
async function findByIdAndGroup(id, groupId) {
  const result = await query(
    `SELECT i.*, u.name AS uploaded_by_name, u.email AS uploaded_by_email
     FROM import_logs i
     JOIN users u ON u.id = i.uploaded_by
     WHERE i.id = $1 AND i.group_id = $2`,
    [id, groupId]
  );
  if (result.rows.length === 0) return null;
  return formatImportLog(result.rows[0]);
}

/**
 * Find an import log by ID.
 * @param {number} id 
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const result = await query(
    `SELECT i.*, u.name AS uploaded_by_name, u.email AS uploaded_by_email
     FROM import_logs i
     JOIN users u ON u.id = i.uploaded_by
     WHERE i.id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return formatImportLog(result.rows[0]);
}

/**
 * Update an import log.
 * @param {number} id 
 * @param {Object} updates 
 * @returns {Promise<Object|null>}
 */
async function update(id, updates) {
  const fields = [];
  const values = [];
  let paramIdx = 1;
  
  const updatableFields = [
    'successCount', 'errorCount', 'skippedCount', 'isConfirmed', 'anomalies'
  ];
  
  const dbFields = {
    successCount: 'success_count',
    errorCount: 'error_count',
    skippedCount: 'skipped_count',
    isConfirmed: 'is_confirmed',
    anomalies: 'anomalies'
  };
  
  for (const key of updatableFields) {
    if (updates[key] !== undefined) {
      fields.push(`${dbFields[key]} = $${paramIdx++}`);
      if (key === 'anomalies') {
        values.push(JSON.stringify(updates[key]));
      } else {
        values.push(updates[key]);
      }
    }
  }
  
  if (fields.length > 0) {
    fields.push(`updated_at = NOW()`);
    values.push(id);
    await query(
      `UPDATE import_logs SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
      values
    );
  }
  
  return findById(id);
}

module.exports = {
  create,
  findByGroup,
  findByIdAndGroup,
  findById,
  update
};
