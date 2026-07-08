const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const GroupMember = require('../models/GroupMember');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: Calculate splits based on splitType
// ---------------------------------------------------------------------------
const { calculateSplits } = require('../utils/splitCalculator');

// ---------------------------------------------------------------------------
// GET /api/groups/:groupId/expenses — get all expenses for a group
// ---------------------------------------------------------------------------
router.get('/:groupId/expenses', auth, async (req, res, next) => {
  try {

    const { groupId } = req.params;
    
    const { includeDeleted, startDate, endDate, paidBy } = req.query;

    const filters = {
      isDeleted: includeDeleted === 'true' ? undefined : false,
    };

    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (paidBy) filters.paidBy = paidBy;

    const expenses = await Expense.findByGroup(groupId, filters);

    res.json({ expenses });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups/:groupId/expenses — add an expense
// ---------------------------------------------------------------------------
router.post('/:groupId/expenses', auth, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const {
      description,
      amount,
      currency,
      amountInINR,
      exchangeRateUsed,
      date,
      paidBy,
      splitType,
      splitWith,
      splitDetails,
      isSettlement,
      notes,
    } = req.body;

    // Validate request
    if (!description || !amount || !date || !paidBy || !splitType || !splitWith) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify payer is in group
    const payerMember = await GroupMember.findByGroupAndUser(groupId, paidBy);
    if (!payerMember) {
      return res.status(400).json({ message: 'Payer is not a member of this group' });
    }

    // Verify all splitWith members are in group
    const memberIds = splitWith.map((user) => user.userId);
    for (const userId of memberIds) {
      const isMember = await GroupMember.findByGroupAndUser(groupId, userId);
      if (!isMember) {
        return res.status(400).json({ message: `User ${userId} is not a member of this group` });
      }
    }

    // Calculate splits
    let finalSplits = [];
    if (!isSettlement) {
      finalSplits = calculateSplits(amount, splitType, splitWith, splitDetails, paidBy);
    } else {
      // For settlements, one person pays another exactly.
      // splitWith should contain the receiver.
      finalSplits = [
        {
          userId: splitWith[0].userId,
          amount: amount,
        },
      ];
    }

    const expense = await Expense.create({
      groupId,
      description,
      amount,
      currency,
      amountInINR: amountInINR || amount,
      exchangeRateUsed: exchangeRateUsed || 1,
      date: date,
      paidBy,
      splitType,
      isSettlement,
      notes,
      splits: finalSplits,
    });

    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:groupId/expenses/:id — get a specific expense
// ---------------------------------------------------------------------------
router.get('/:groupId/expenses/:id', auth, async (req, res, next) => {
  try {
    const { groupId, id } = req.params;

    const expense = await Expense.findByIdAndGroup(id, groupId);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({ expense });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/groups/:groupId/expenses/:id — edit an expense
// ---------------------------------------------------------------------------
router.put('/:groupId/expenses/:id', auth, async (req, res, next) => {
  try {
    const { groupId, id } = req.params;
    const updateData = req.body;

    const expense = await Expense.findByIdAndGroup(id, groupId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    if (expense.isDeleted) {
      return res.status(400).json({ message: 'Cannot edit a deleted expense' });
    }

    const updates = {};
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.amount !== undefined) updates.amount = updateData.amount;
    if (updateData.currency !== undefined) updates.currency = updateData.currency;
    if (updateData.amountInINR !== undefined) updates.amountInINR = updateData.amountInINR;
    if (updateData.exchangeRateUsed !== undefined) updates.exchangeRateUsed = updateData.exchangeRateUsed;
    if (updateData.date !== undefined) updates.date = updateData.date;
    if (updateData.paidBy !== undefined) updates.paidBy = updateData.paidBy;
    if (updateData.splitType !== undefined) updates.splitType = updateData.splitType;
    if (updateData.isSettlement !== undefined) updates.isSettlement = updateData.isSettlement;
    if (updateData.notes !== undefined) updates.notes = updateData.notes;

    // Recalculate splits if amount, splitType, splitWith, or splitDetails change
    if (
      updateData.amount !== undefined ||
      updateData.splitType !== undefined ||
      updateData.splitWith !== undefined ||
      updateData.splitDetails !== undefined ||
      updateData.isSettlement !== undefined
    ) {
      const amount = updateData.amount !== undefined ? updateData.amount : expense.amount;
      const splitType = updateData.splitType || expense.splitType;
      const splitWith = updateData.splitWith; // Assuming if one changes, frontend sends all related fields
      const splitDetails = updateData.splitDetails;
      const isSettlement = updateData.isSettlement !== undefined ? updateData.isSettlement : expense.isSettlement;
      const paidBy = updateData.paidBy || expense.paidBy.id;

      if (!isSettlement && splitWith) {
        updates.splits = calculateSplits(amount, splitType, splitWith, splitDetails, paidBy);
      } else if (isSettlement && splitWith) {
        updates.splits = [
          {
            userId: splitWith[0].userId,
            amount: amount,
          },
        ];
      }
    }

    const updatedExpense = await Expense.update(id, updates);

    res.json({ expense: updatedExpense });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/groups/:groupId/expenses/:id — soft delete an expense
// ---------------------------------------------------------------------------
router.delete('/:groupId/expenses/:id', auth, async (req, res, next) => {
  try {
    const { groupId, id } = req.params;

    const expense = await Expense.findByIdAndGroup(id, groupId);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const updatedExpense = await Expense.softDelete(id);

    res.json({ message: 'Expense deleted successfully', expense: updatedExpense });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
