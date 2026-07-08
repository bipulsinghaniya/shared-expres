function calculateSplits(amount, splitType, splitWith, splitDetails, payerId) {
  let finalSplits = [];
  const memberIds = splitWith.map((user) => user.userId);

  if (splitType === 'EQUAL') {
    const splitAmount = amount / memberIds.length;
    finalSplits = memberIds.map((userId) => ({
      userId,
      amount: splitAmount,
    }));
  } else if (splitType === 'EXACT') {
    // Validate exact amounts
    const totalSplit = splitDetails.reduce((sum, split) => sum + (split.value || split.amount || 0), 0);
    // Allow small floating point differences
    if (Math.abs(totalSplit - amount) > 0.01) {
      const { createError } = require('../middleware/errorHandler');
      throw createError(400, 'Exact split amounts must sum to total amount');
    }
    finalSplits = splitDetails.map((split) => ({
      userId: split.userId,
      amount: (split.value || split.amount || 0),
    }));
  } else if (splitType === 'PERCENTAGE') {
    const totalPercentage = splitDetails.reduce((sum, split) => sum + (split.value || split.percentage || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      const { createError } = require('../middleware/errorHandler');
      throw createError(400, 'Percentages must sum to 100');
    }
    finalSplits = splitDetails.map((split) => ({
      userId: split.userId,
      amount: (amount * (split.value || split.percentage || 0)) / 100,
    }));
  } else if (splitType === 'SHARES') {
    const totalShares = splitDetails.reduce((sum, split) => sum + (split.value || split.shares || 0), 0);
    const amountPerShare = amount / totalShares;
    finalSplits = splitDetails.map((split) => ({
      userId: split.userId,
      amount: amountPerShare * (split.value || split.shares || 0),
    }));
  }

  return finalSplits;
}

module.exports = { calculateSplits };
