/**
 * Balance Calculator Service
 * ==========================
 * Pure functions for computing net balances across all members in a group.
 * All calculations use amountInINR to ensure consistent currency.
 *
 * Key rule: isDeleted expenses are excluded entirely.
 *           isSettlement expenses adjust balances directly (not split).
 *           Regular expenses credit the payer and debit each split member.
 */

// ---------------------------------------------------------------------------
// Main: Calculate net balances for all members
// ---------------------------------------------------------------------------

/**
 * Calculate the net balance for every member in a group.
 *
 * Logic:
 *   For each NON-DELETED, NON-SETTLEMENT expense:
 *     - Credit the payer (paidBy) the full amountInINR
 *     - Debit each split member their split.amount
 *
 *   For each NON-DELETED SETTLEMENT:
 *     - Credit the payer (they gave money)    → payer balance goes UP
 *     - Debit the receiver (they received money) → receiver balance goes DOWN
 *     - Settlements have exactly one split entry: the receiver
 *
 * Net balance:
 *   Positive → others owe this person money
 *   Negative → this person owes others money
 *
 * @param {Array} expenses - All expenses for the group (caller should include
 *                           both regular and settlement expenses).
 * @param {Array} members  - All GroupMember documents (with populated userId).
 * @returns {Object} Map of { [userId string]: { userId, name, email, balance } }
 */
function calculateBalances(expenses, members) {
  // Initialize balance map with all members at zero
  const balances = {};

  for (const member of members) {
    const uid = String(member.userId._id || member.userId);
    const userName = member.userId.name || member.userId;
    const userEmail = member.userId.email || '';

    balances[uid] = {
      userId: uid,
      name: userName,
      email: userEmail,
      balance: 0,
      totalPaid: 0,
      totalOwed: 0,
    };
  }

  // Process each expense
  for (const expense of expenses) {
    // Skip deleted expenses — they must NEVER affect balances
    if (expense.isDeleted) continue;

    const payerId = String(expense.paidBy.id || expense.paidBy);
    const amountINR = expense.amountInINR;

    // Ensure the payer exists in the balance map
    if (!balances[payerId]) {
      balances[payerId] = {
        userId: payerId,
        name: expense.paidBy.name || payerId,
        email: expense.paidBy.email || '',
        balance: 0,
        totalPaid: 0,
        totalOwed: 0,
      };
    }


    if (expense.isSettlement) {
      // ---------------------------------------------------------------
      // SETTLEMENT: direct transfer between two people
      // The payer gave money to the receiver.
      //   - Payer's balance increases (they are owed less / owe less)
      //   - Receiver's balance decreases (they owe less / are owed less)
      //
      // Settlements have splits = [{ userId: receiverId, amount }]
      // ---------------------------------------------------------------
      for (const split of expense.splits) {
        const receiverId = String(split.userId.id || split.userId);
        const transferAmount = split.amount;

        // Payer paid out money → credit (positive adjustment)
        balances[payerId].balance += transferAmount;
        balances[payerId].totalPaid += transferAmount;

        // Receiver received money → debit (negative adjustment)
        if (!balances[receiverId]) {
          balances[receiverId] = {
            userId: receiverId,
            name: split.userId.name || receiverId,
            email: split.userId.email || '',
            balance: 0,
            totalPaid: 0,
            totalOwed: 0,
          };
        }
        balances[receiverId].balance -= transferAmount;
        balances[receiverId].totalOwed += transferAmount;
      }
    } else {
      // ---------------------------------------------------------------
      // REGULAR EXPENSE:
      //   - Payer fronted the full amount → credit them amountInINR
      //   - Each split member owes their share → debit each split.amount
      // ---------------------------------------------------------------

      // Credit the payer
      balances[payerId].balance += amountINR;
      balances[payerId].totalPaid += amountINR;

      // Debit each split member
      for (const split of expense.splits) {
        const memberId = String(split.userId.id || split.userId);
        const memberShare = split.amount;

        if (!balances[memberId]) {
          balances[memberId] = {
            userId: memberId,
            name: split.userId.name || memberId,
            email: split.userId.email || '',
            balance: 0,
            totalPaid: 0,
            totalOwed: 0,
          };
        }

        balances[memberId].balance -= memberShare;
        balances[memberId].totalOwed += memberShare;
      }
    }
  }

  // Round all balances to 2 decimal places
  for (const uid of Object.keys(balances)) {
    balances[uid].balance = Math.round(balances[uid].balance * 100) / 100;
    balances[uid].totalPaid = Math.round(balances[uid].totalPaid * 100) / 100;
    balances[uid].totalOwed = Math.round(balances[uid].totalOwed * 100) / 100;
  }

  return balances;
}

// ---------------------------------------------------------------------------
// Expense Breakdown for a single member
// ---------------------------------------------------------------------------

/**
 * Get a detailed breakdown of every expense that involves a specific member.
 * This includes expenses they paid AND expenses where they appear in splits.
 *
 * For each expense, show:
 *   - The expense details
 *   - How much they paid (if they were payer)
 *   - How much they owe (their split amount)
 *   - Their net for this expense
 *
 * @param {Array}  expenses - All non-deleted expenses for the group.
 * @param {string} userId   - The member's user ID to get breakdown for.
 * @returns {Array} Array of expense detail objects.
 */
function getExpenseBreakdown(expenses, userId) {
  const uid = String(userId);
  const breakdown = [];

  for (const expense of expenses) {
    // Skip deleted expenses
    if (expense.isDeleted) continue;

    const payerId = String(expense.paidBy.id || expense.paidBy);
    const isPayer = payerId === uid;

    // Find this member's split entry (if any)
    const splitEntry = expense.splits.find(
      (s) => String(s.userId.id || s.userId) === uid
    );
    const isInSplit = !!splitEntry;

    // Only include if this member is involved
    if (!isPayer && !isInSplit) continue;

    const paidAmount = isPayer ? expense.amountInINR : 0;
    const owedAmount = isInSplit ? splitEntry.amount : 0;

    let netEffect;
    if (expense.isSettlement) {
      // For settlements:
      //   If this member is the payer → they gave money → positive effect
      //   If this member is the receiver → they received money → negative effect
      netEffect = isPayer ? paidAmount : -owedAmount;
    } else {
      // For regular expenses:
      //   Net = what they paid − what they owe
      netEffect = paidAmount - owedAmount;
    }

    breakdown.push({
      expenseId: expense.id || expense._id,
      date: expense.date,
      description: expense.description,
      totalAmount: expense.amount,
      currency: expense.currency,
      amountInINR: expense.amountInINR,
      splitType: expense.splitType,
      isSettlement: expense.isSettlement,
      paidByName: expense.paidBy.name || 'Unknown',
      isPayer,
      paidAmount: Math.round(paidAmount * 100) / 100,
      owedAmount: Math.round(owedAmount * 100) / 100,
      netEffect: Math.round(netEffect * 100) / 100,
    });
  }

  // Sort by date descending
  breakdown.sort((a, b) => new Date(b.date) - new Date(a.date));

  return breakdown;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = { calculateBalances, getExpenseBreakdown };
