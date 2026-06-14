const { pool, query } = require('../database');

/**
 * Helper to build the final expense object matching Mongoose output.
 */
function formatExpense(row, splits = []) {
  if (!row) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    amountInINR: row.amount_in_inr,
    exchangeRateUsed: row.exchange_rate_used,
    date: row.date,
    paidBy: {
      id: row.paid_by,
      name: row.paid_by_name,
      email: row.paid_by_email,
    },
    splitType: row.split_type,
    splits: splits.map(s => ({
      userId: {
        id: s.user_id,
        name: s.user_name,
        email: s.user_email,
      },
      amount: s.amount
    })),
    isSettlement: row.is_settlement,
    isDeleted: row.is_deleted,
    importRowIndex: row.import_row_index,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/**
 * Fetch splits for a set of expense IDs.
 * @param {number[]} expenseIds
 * @returns {Promise<Object>} Map of expenseId -> array of splits
 */
async function fetchSplitsForExpenses(expenseIds) {
  if (!expenseIds || expenseIds.length === 0) return {};
  
  const result = await query(
    `SELECT es.*, u.name AS user_name, u.email AS user_email
     FROM expense_splits es
     JOIN users u ON u.id = es.user_id
     WHERE es.expense_id = ANY($1)`,
    [expenseIds]
  );
  
  const splitsMap = {};
  for (const row of result.rows) {
    if (!splitsMap[row.expense_id]) splitsMap[row.expense_id] = [];
    splitsMap[row.expense_id].push(row);
  }
  return splitsMap;
}

/**
 * Create a new expense.
 * Uses a transaction to insert both the expense and its splits.
 * @param {Object} data 
 * @returns {Promise<Object>}
 */
async function create(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert expense
    const expRes = await client.query(
      `INSERT INTO expenses (
        group_id, description, amount, currency, amount_in_inr, 
        exchange_rate_used, date, paid_by, split_type, is_settlement, 
        import_row_index, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING *`,
      [
        data.groupId, data.description, data.amount, data.currency || 'INR', 
        data.amountInINR, data.exchangeRateUsed || 1, new Date(data.date), 
        data.paidBy, data.splitType, data.isSettlement || false, 
        data.importRowIndex || null, data.notes || ''
      ]
    );
    const expense = expRes.rows[0];
    
    // Insert splits
    for (const split of data.splits) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount) 
         VALUES ($1, $2, $3)`,
        [expense.id, split.userId, split.amount]
      );
    }
    
    await client.query('COMMIT');
    return findById(expense.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Find expenses for a group, with optional filters.
 * @param {number} groupId 
 * @param {Object} filters 
 * @returns {Promise<Object[]>}
 */
async function findByGroup(groupId, filters = {}) {
  const conditions = ['e.group_id = $1'];
  const values = [groupId];
  let paramIdx = 2;

  if (filters.isDeleted !== undefined) {
    conditions.push(`e.is_deleted = $${paramIdx++}`);
    values.push(filters.isDeleted);
  }
  if (filters.paidBy !== undefined) {
    conditions.push(`e.paid_by = $${paramIdx++}`);
    values.push(filters.paidBy);
  }
  if (filters.splitType !== undefined) {
    conditions.push(`e.split_type = $${paramIdx++}`);
    values.push(filters.splitType);
  }
  if (filters.startDate !== undefined) {
    conditions.push(`e.date >= $${paramIdx++}`);
    values.push(new Date(filters.startDate));
  }
  if (filters.endDate !== undefined) {
    conditions.push(`e.date <= $${paramIdx++}`);
    values.push(new Date(filters.endDate));
  }

  const result = await query(
    `SELECT e.*, u.name AS paid_by_name, u.email AS paid_by_email
     FROM expenses e
     JOIN users u ON u.id = e.paid_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.date DESC`,
    values
  );

  const expenses = result.rows;
  if (expenses.length === 0) return [];

  const splitsMap = await fetchSplitsForExpenses(expenses.map(e => e.id));
  
  return expenses.map(e => formatExpense(e, splitsMap[e.id] || []));
}

/**
 * Find a single expense by ID and group ID.
 * @param {number} id 
 * @param {number} groupId 
 * @returns {Promise<Object|null>}
 */
async function findByIdAndGroup(id, groupId) {
  const result = await query(
    `SELECT e.*, u.name AS paid_by_name, u.email AS paid_by_email
     FROM expenses e
     JOIN users u ON u.id = e.paid_by
     WHERE e.id = $1 AND e.group_id = $2`,
    [id, groupId]
  );
  
  if (result.rows.length === 0) return null;
  
  const expense = result.rows[0];
  const splitsMap = await fetchSplitsForExpenses([expense.id]);
  
  return formatExpense(expense, splitsMap[expense.id] || []);
}

/**
 * Find a single expense by ID.
 * @param {number} id 
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const result = await query(
    `SELECT e.*, u.name AS paid_by_name, u.email AS paid_by_email
     FROM expenses e
     JOIN users u ON u.id = e.paid_by
     WHERE e.id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) return null;
  
  const expense = result.rows[0];
  const splitsMap = await fetchSplitsForExpenses([expense.id]);
  
  return formatExpense(expense, splitsMap[expense.id] || []);
}

/**
 * Update an expense.
 * Updates basic fields, and if splits are provided, replaces all splits.
 * @param {number} id 
 * @param {Object} updates 
 * @returns {Promise<Object|null>}
 */
async function update(id, updates) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const fields = [];
    const values = [];
    let paramIdx = 1;
    
    // Simple fields
    const updatableFields = [
      'description', 'amount', 'currency', 'amountInINR', 'exchangeRateUsed', 
      'date', 'paidBy', 'splitType', 'isSettlement', 'notes'
    ];
    
    // Map camelCase to snake_case
    const dbFields = {
      amountInINR: 'amount_in_inr',
      exchangeRateUsed: 'exchange_rate_used',
      paidBy: 'paid_by',
      splitType: 'split_type',
      isSettlement: 'is_settlement'
    };
    
    for (const key of updatableFields) {
      if (updates[key] !== undefined) {
        const dbCol = dbFields[key] || key;
        fields.push(`${dbCol} = $${paramIdx++}`);
        values.push(key === 'date' ? new Date(updates[key]) : updates[key]);
      }
    }
    
    if (fields.length > 0) {
      values.push(id);
      await client.query(
        `UPDATE expenses SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
        values
      );
    }
    
    // Update splits if provided
    if (updates.splits && Array.isArray(updates.splits)) {
      await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [id]);
      
      for (const split of updates.splits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount) 
           VALUES ($1, $2, $3)`,
          [id, split.userId, split.amount]
        );
      }
    }
    
    await client.query('COMMIT');
    return findById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Soft delete an expense.
 * @param {number} id 
 * @returns {Promise<Object|null>}
 */
async function softDelete(id) {
  await query('UPDATE expenses SET is_deleted = TRUE WHERE id = $1', [id]);
  return findById(id);
}

/**
 * Count total expenses for a group (excluding deleted/settlements).
 * @param {number} groupId 
 * @returns {Promise<number>}
 */
async function countByGroup(groupId) {
  const result = await query(
    'SELECT COUNT(*)::int AS count FROM expenses WHERE group_id = $1 AND is_deleted = FALSE',
    [groupId]
  );
  return result.rows[0].count;
}

module.exports = {
  create,
  findByGroup,
  findByIdAndGroup,
  findById,
  update,
  softDelete,
  countByGroup
};
