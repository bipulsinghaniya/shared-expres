/**
 * Settlement Optimizer Service
 * ============================
 * Greedy algorithm to minimise the number of transactions needed
 * to settle all debts within a group.
 *
 * Algorithm:
 *   1. Separate members into creditors (positive balance) and debtors (negative balance)
 *   2. Sort creditors descending by balance, debtors descending by absolute debt
 *   3. Match largest debtor to largest creditor
 *   4. Transfer min(|debt|, credit), reduce both balances
 *   5. Remove anyone who reaches zero, repeat until all settled
 *
 * This greedy approach produces an optimal or near-optimal number of transactions.
 */

/**
 * Suggest minimum settlement transactions given a balance map.
 *
 * @param {Object} balances - Map of userId → { userId, name, balance, ... }
 *                            Positive balance = owed money (creditor)
 *                            Negative balance = owes money (debtor)
 * @returns {Array<{ from: { userId, name }, to: { userId, name }, amount: number }>}
 *          Array of settlement transactions, sorted by amount descending.
 */
function suggestSettlements(balances) {
  // -----------------------------------------------------------------------
  // Step 1: Build creditor and debtor lists
  // -----------------------------------------------------------------------
  const creditors = []; // People who are owed money  (balance > 0)
  const debtors = [];   // People who owe money       (balance < 0)

  const THRESHOLD = 0.01; // Ignore tiny floating-point residuals

  for (const uid of Object.keys(balances)) {
    const entry = balances[uid];
    const bal = entry.balance;

    if (bal > THRESHOLD) {
      creditors.push({
        userId: entry.userId,
        name: entry.name,
        amount: bal,
      });
    } else if (bal < -THRESHOLD) {
      debtors.push({
        userId: entry.userId,
        name: entry.name,
        amount: Math.abs(bal),
      });
    }
    // balance ≈ 0 → no action needed
  }

  // -----------------------------------------------------------------------
  // Step 2: Sort both lists by amount descending (largest first)
  // -----------------------------------------------------------------------
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // -----------------------------------------------------------------------
  // Step 3: Greedy matching
  // -----------------------------------------------------------------------
  const settlements = [];

  let ci = 0; // Creditor index
  let di = 0; // Debtor index

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    // Transfer the smaller of the two amounts
    const transferAmount = Math.min(creditor.amount, debtor.amount);

    // Round to 2 decimal places to avoid floating-point artifacts
    const roundedAmount = Math.round(transferAmount * 100) / 100;

    if (roundedAmount > THRESHOLD) {
      settlements.push({
        from: {
          userId: debtor.userId,
          name: debtor.name,
        },
        to: {
          userId: creditor.userId,
          name: creditor.name,
        },
        amount: roundedAmount,
      });
    }

    // Reduce both balances
    creditor.amount -= transferAmount;
    debtor.amount -= transferAmount;

    // Advance past anyone who's been fully settled
    if (creditor.amount < THRESHOLD) ci++;
    if (debtor.amount < THRESHOLD) di++;
  }

  // Sort settlements by amount descending (largest payments first)
  settlements.sort((a, b) => b.amount - a.amount);

  return settlements;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = { suggestSettlements };
