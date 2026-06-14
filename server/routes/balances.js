const express = require('express');
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const Expense = require('../models/Expense');
const { calculateBalances } = require('../services/balanceCalculator');
const { optimizeSettlements } = require('../services/settlementOptimizer');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/groups/:groupId/balances — calculate balances for a group
// ---------------------------------------------------------------------------
router.get('/:groupId/balances', auth, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Fetch all active/inactive members
    const groupMembers = await GroupMember.getAllMembers(groupId);

    // Fetch all non-deleted expenses for this group
    const expenses = await Expense.findByGroup(groupId, { isDeleted: false });

    // Step 1: Calculate net balances based on all expenses and membership dates
    const netBalances = calculateBalances(expenses, groupMembers);

    // Step 2: Optimize the number of transactions required to settle up
    const settlements = optimizeSettlements(netBalances);

    res.json({
      balances: netBalances,
      settlements,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
