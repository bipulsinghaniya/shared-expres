const { calculateBalances, getExpenseBreakdown } = require('../services/balanceCalculator');

describe('Balance Calculator Service', () => {
  const members = [
    { userId: { _id: 'u1', name: 'Aisha', email: 'aisha@flatmates.com' } },
    { userId: { _id: 'u2', name: 'Rohan', email: 'rohan@flatmates.com' } },
    { userId: { _id: 'u3', name: 'Priya', email: 'priya@flatmates.com' } },
  ];

  test('should calculate balances for equal splits correctly', () => {
    // Aisha pays 1500 INR, split EQUAL among Aisha, Rohan, Priya (500 each)
    const expenses = [
      {
        _id: 'e1',
        isDeleted: false,
        isSettlement: false,
        paidBy: { _id: 'u1', name: 'Aisha', email: 'aisha@flatmates.com' },
        amountInINR: 1500,
        splits: [
          { userId: 'u1', amount: 500 },
          { userId: 'u2', amount: 500 },
          { userId: 'u3', amount: 500 },
        ],
      },
    ];

    const result = calculateBalances(expenses, members);

    // Aisha paid 1500, owes 500 → net balance is +1000
    // Rohan paid 0, owes 500 → net balance is -500
    // Priya paid 0, owes 500 → net balance is -500
    expect(result['u1'].balance).toBe(1000);
    expect(result['u1'].totalPaid).toBe(1500);
    expect(result['u1'].totalOwed).toBe(500);

    expect(result['u2'].balance).toBe(-500);
    expect(result['u2'].totalPaid).toBe(0);
    expect(result['u2'].totalOwed).toBe(500);

    expect(result['u3'].balance).toBe(-500);
    expect(result['u3'].totalPaid).toBe(0);
    expect(result['u3'].totalOwed).toBe(500);
  });

  test('should skip deleted expenses', () => {
    const expenses = [
      {
        _id: 'e1',
        isDeleted: true,
        isSettlement: false,
        paidBy: { _id: 'u1', name: 'Aisha' },
        amountInINR: 1500,
        splits: [
          { userId: 'u1', amount: 500 },
          { userId: 'u2', amount: 500 },
          { userId: 'u3', amount: 500 },
        ],
      },
    ];

    const result = calculateBalances(expenses, members);
    expect(result['u1'].balance).toBe(0);
    expect(result['u2'].balance).toBe(0);
  });

  test('should handle settlements correctly', () => {
    // Rohan pays Priya 500 INR settlement directly
    // This is NOT split. Rohan pays, Priya receives.
    // Rohan balance increases by 500 (owed less / credit).
    // Priya balance decreases by 500 (receives money / debit).
    const expenses = [
      {
        _id: 'e2',
        isDeleted: false,
        isSettlement: true,
        paidBy: { _id: 'u2', name: 'Rohan' },
        amountInINR: 500,
        splits: [
          { userId: 'u3', amount: 500 }, // u3 (Priya) is the receiver
        ],
      },
    ];

    const result = calculateBalances(expenses, members);

    expect(result['u2'].balance).toBe(500);
    expect(result['u3'].balance).toBe(-500);
  });

  test('should compute expense breakdown for a single member', () => {
    const expenses = [
      {
        _id: 'e1',
        description: 'Groceries',
        date: new Date('2024-01-15'),
        amount: 1500,
        currency: 'INR',
        isDeleted: false,
        isSettlement: false,
        paidBy: { _id: 'u1', name: 'Aisha' },
        amountInINR: 1500,
        splitType: 'EQUAL',
        splits: [
          { userId: 'u1', amount: 500 },
          { userId: 'u2', amount: 500 },
        ],
      },
      {
        _id: 'e2',
        description: 'Internet',
        date: new Date('2024-01-20'),
        amount: 1000,
        currency: 'INR',
        isDeleted: false,
        isSettlement: false,
        paidBy: { _id: 'u2', name: 'Rohan' },
        amountInINR: 1000,
        splitType: 'EQUAL',
        splits: [
          { userId: 'u1', amount: 500 },
          { userId: 'u2', amount: 500 },
        ],
      },
    ];

    const breakdown = getExpenseBreakdown(expenses, 'u1');

    expect(breakdown.length).toBe(2);
    // Should be sorted by date descending (Internet e2 first)
    expect(breakdown[0].expenseId).toBe('e2');
    expect(breakdown[0].isPayer).toBe(false);
    expect(breakdown[0].paidAmount).toBe(0);
    expect(breakdown[0].owedAmount).toBe(500);
    expect(breakdown[0].netEffect).toBe(-500);

    expect(breakdown[1].expenseId).toBe('e1');
    expect(breakdown[1].isPayer).toBe(true);
    expect(breakdown[1].paidAmount).toBe(1500);
    expect(breakdown[1].owedAmount).toBe(500);
    expect(breakdown[1].netEffect).toBe(1000);
  });
});
