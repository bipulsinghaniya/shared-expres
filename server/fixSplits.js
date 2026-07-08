require('dotenv').config();
const { pool } = require('./database');
const { calculateSplits } = require('./utils/splitCalculator');
const GroupMember = require('./models/GroupMember');

async function fixMissingSplits() {
  const client = await pool.connect();
  try {
    // 1. Find all expenses that have no splits
    const { rows: badExpenses } = await client.query(`
      SELECT e.*
      FROM expenses e
      LEFT JOIN expense_splits es ON e.id = es.expense_id
      WHERE es.id IS NULL AND e.is_deleted = false AND e.is_settlement = false
    `);

    console.log(`Found ${badExpenses.length} regular expenses missing splits.`);

    for (const exp of badExpenses) {
      if (exp.split_type === 'EQUAL') {
        const activeMembers = await GroupMember.getActiveMembers(exp.group_id, exp.date);
        const splitWith = activeMembers.map(m => ({ userId: m.userId.id || m.userId }));
        
        const splits = calculateSplits(exp.amount_in_inr || exp.amount, 'EQUAL', splitWith, [], exp.paid_by);
        
        for (const split of splits) {
          await client.query(
            `INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)`,
            [exp.id, split.userId, split.amount]
          );
        }
        console.log(`Fixed splits for expense ${exp.id} (${exp.description})`);
      }
    }

    console.log('Done!');
  } catch (err) {
    console.error('Error fixing splits:', err);
  } finally {
    client.release();
    pool.end();
  }
}

fixMissingSplits();
