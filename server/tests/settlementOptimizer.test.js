const { suggestSettlements } = require('../services/settlementOptimizer');

describe('Settlement Optimizer Service', () => {
  test('should optimize simple three-way debt correctly', () => {
    const balances = {
      u1: { userId: 'u1', name: 'Aisha', balance: 1000 },
      u2: { userId: 'u2', name: 'Rohan', balance: -500 },
      u3: { userId: 'u3', name: 'Priya', balance: -500 },
    };

    const settlements = suggestSettlements(balances);

    expect(settlements).toHaveLength(2);
    
    // We expect both u2 and u3 to pay u1 500 INR.
    const payAisha = settlements.filter(s => s.to.userId === 'u1');
    expect(payAisha).toHaveLength(2);
    expect(payAisha[0].amount).toBe(500);
    expect(payAisha[1].amount).toBe(500);

    const payers = payAisha.map(s => s.from.userId);
    expect(payers).toContain('u2');
    expect(payers).toContain('u3');
  });

  test('should handle zero/near-zero balances without generating actions', () => {
    const balances = {
      u1: { userId: 'u1', name: 'Aisha', balance: 0.004 },
      u2: { userId: 'u2', name: 'Rohan', balance: -0.003 },
    };

    const settlements = suggestSettlements(balances);
    expect(settlements).toHaveLength(0);
  });

  test('should optimize complex multi-person debt correctly', () => {
    // Aisha: +600, Rohan: +400, Priya: -700, Meera: -300
    const balances = {
      u1: { userId: 'u1', name: 'Aisha', balance: 600 },
      u2: { userId: 'u2', name: 'Rohan', balance: 400 },
      u3: { userId: 'u3', name: 'Priya', balance: -700 },
      u4: { userId: 'u4', name: 'Meera', balance: -300 },
    };

    const settlements = suggestSettlements(balances);

    // Greedy matching sorts:
    // Creditors: Aisha (600), Rohan (400)
    // Debtors: Priya (700), Meera (300)
    //
    // Step 1: match Priya (700) to Aisha (600).
    //   Transfer amount = min(600, 700) = 600.
    //   Priya still owes 100. Aisha fully settled.
    // Step 2: match Priya (100) to Rohan (400).
    //   Transfer amount = min(100, 400) = 100.
    //   Priya fully settled. Rohan still owed 300.
    // Step 3: match Meera (300) to Rohan (300).
    //   Transfer amount = 300.
    //   Both settled.
    //
    // Total transactions: 3
    expect(settlements).toHaveLength(3);

    // Priya pays Aisha 600
    // Meera pays Rohan 300
    // Priya pays Rohan 100
    expect(settlements[0]).toEqual({
      from: { userId: 'u3', name: 'Priya' },
      to: { userId: 'u1', name: 'Aisha' },
      amount: 600,
    });
    expect(settlements[1]).toEqual({
      from: { userId: 'u4', name: 'Meera' },
      to: { userId: 'u2', name: 'Rohan' },
      amount: 300,
    });
    expect(settlements[2]).toEqual({
      from: { userId: 'u3', name: 'Priya' },
      to: { userId: 'u2', name: 'Rohan' },
      amount: 100,
    });
  });
});
