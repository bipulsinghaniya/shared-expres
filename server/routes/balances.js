const express = require('express');
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const Expense = require('../models/Expense');
const { calculateBalances, getExpenseBreakdown } = require('../services/balanceCalculator');
const { suggestSettlements } = require('../services/settlementOptimizer');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: fetch members + non-deleted expenses for a group
// ---------------------------------------------------------------------------
async function loadGroupData(groupId) {
  const [groupMembers, expenses] = await Promise.all([
    GroupMember.getAllMembers(groupId),
    Expense.findByGroup(groupId, { isDeleted: false }),
  ]);
  return { groupMembers, expenses };
}

// ---------------------------------------------------------------------------
// GET /api/groups/:groupId/balances
// Returns net balances for every member (dynamically calculated).
//
// Formula per member:
//   balance = totalPaid − totalOwed
//   Positive → others owe this person
//   Negative → this person owes others
// ---------------------------------------------------------------------------
router.get('/:groupId/balances', auth, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const { groupMembers, expenses } = await loadGroupData(groupId);

    // Dynamically calculate — never read from a stored balance column
    const netBalances = calculateBalances(expenses, groupMembers);
    const settlements = suggestSettlements(netBalances);

    // Count only non-settlement, non-deleted expenses
    const totalExpenses = expenses.filter((e) => !e.isSettlement && !e.isDeleted).length;

    res.json({
      balances: Object.values(netBalances),
      settlements,
      totalExpenses,
      totalSettlements: settlements.length,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:groupId/settlements
// Returns the minimum set of transactions to settle all debts.
// Kept as a separate endpoint so the client can fetch it independently.
// ---------------------------------------------------------------------------
router.get('/:groupId/settlements', auth, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const { groupMembers, expenses } = await loadGroupData(groupId);
    const netBalances = calculateBalances(expenses, groupMembers);
    const settlements = suggestSettlements(netBalances);

    res.json({ settlements });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:groupId/balances/:userId
// Returns a detailed per-expense breakdown for a specific member.
//
// Response shape:
//   { memberName, totalPaid, totalOwed, netBalance, expenseCount, breakdown[] }
// ---------------------------------------------------------------------------
router.get('/:groupId/balances/:userId', auth, async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Verify the requested user is a group member
    const memberRecord = await GroupMember.findByGroupAndUser(groupId, userId);
    if (!memberRecord) {
      return res.status(404).json({ message: 'Member not found in this group' });
    }

    const expenses = await Expense.findByGroup(groupId, { isDeleted: false });
    const breakdown = getExpenseBreakdown(expenses, userId);

    // Aggregate totals from the breakdown
    const totalPaid = breakdown.reduce((sum, item) => sum + item.paidAmount, 0);
    const totalOwed = breakdown.reduce((sum, item) => sum + item.owedAmount, 0);
    const netBalance = Math.round((totalPaid - totalOwed) * 100) / 100;

    res.json({
      memberName: memberRecord.userId.name,
      memberEmail: memberRecord.userId.email,
      userId,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOwed: Math.round(totalOwed * 100) / 100,
      netBalance,
      expenseCount: breakdown.length,
      breakdown,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
