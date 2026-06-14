const { parseAndAnalyzeCSV, parseSplitDetails } = require('../services/csvImporter');
const GroupMember = require('../models/GroupMember');

// Mock GroupMember model
jest.mock('../models/GroupMember');

describe('CSV Importer Service', () => {
  const groupId = '609b5c39c8f9df0015f6ad12';

  const mockMembers = [
    {
      userId: { _id: 'u1', name: 'Aisha', email: 'aisha@flatmates.com' },
      joinDate: new Date('2026-01-01'),
      leaveDate: null,
    },
    {
      userId: { _id: 'u2', name: 'Rohan', email: 'rohan@flatmates.com' },
      joinDate: new Date('2026-01-01'),
      leaveDate: null,
    },
    {
      userId: { _id: 'u3', name: 'Priya', email: 'priya@flatmates.com' },
      joinDate: new Date('2026-01-01'),
      leaveDate: null,
    },
    {
      userId: { _id: 'u4', name: 'Meera', email: 'meera@flatmates.com' },
      joinDate: new Date('2026-01-01'),
      leaveDate: new Date('2026-03-31'), // Left end of March
    },
    {
      userId: { _id: 'u5', name: 'Sam', email: 'sam@flatmates.com' },
      joinDate: new Date('2026-04-15'), // Joined mid-April
      leaveDate: null,
    },
    {
      userId: { _id: 'u6', name: 'Dev', email: 'dev@flatmates.com' },
      joinDate: new Date('2026-02-01'), // Joined Feb
      leaveDate: new Date('2026-03-20'), // Left Mar
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    GroupMember.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockMembers),
    });
  });

  test('should parse valid EQUAL split row without anomalies', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-01-15,Groceries,1500,INR,Aisha,EQUAL,,Weekly groceries";

    const { parsedRows, anomalies, summary } = await parseAndAnalyzeCSV(csvString, groupId);

    expect(anomalies).toHaveLength(0);
    expect(parsedRows).toHaveLength(1);
    expect(parsedRows[0].description).toBe('Groceries');
    expect(parsedRows[0].amountInINR).toBe(1500);
    expect(parsedRows[0].paidByName).toBe('Aisha');
    expect(parsedRows[0].splitType).toBe('EQUAL');
    expect(summary.successCount).toBe(1);
  });

  test('should parse tab-separated CSV file with split_with and semicolon split details', async () => {
    const tsvString = 
      "date\tdescription\tpaid_by\tamount\tcurrency\tsplit_type\tsplit_with\tsplit_details\tnotes\n" +
      "01-02-2026\tFebruary rent\tAisha\t48000\tINR\tequal\tAisha;Rohan;Priya;Meera\t\t\n" +
      "20-02-2026\tAisha birthday cake\tRohan\t1500\tINR\tunequal\tRohan;Priya;Meera\tRohan 700; Priya 400; Meera 400\tAisha not charged";

    const { parsedRows, anomalies } = await parseAndAnalyzeCSV(tsvString, groupId);

    expect(anomalies).toHaveLength(0);
    expect(parsedRows).toHaveLength(2);

    // Row 1: EQUAL with split_with
    expect(parsedRows[0].description).toBe('February rent');
    expect(parsedRows[0].splitType).toBe('EQUAL');
    expect(parsedRows[0].splitWith).toHaveLength(4);
    expect(parsedRows[0].splitWith[0].name).toBe('Aisha');

    // Row 2: UNEQUAL mapped to EXACT with custom separators and spaces
    expect(parsedRows[1].description).toBe('Aisha birthday cake');
    expect(parsedRows[1].splitType).toBe('EXACT');
    expect(parsedRows[1].splitDetails).toHaveLength(3);
    expect(parsedRows[1].splitDetails[0].name).toBe('Rohan');
    expect(parsedRows[1].splitDetails[0].value).toBe(700);
  });

  test('should parse short date formats such as Mar-14', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "Mar-14,Airport cab,1100,INR,Rohan,EQUAL,,";

    const { parsedRows } = await parseAndAnalyzeCSV(csvString, groupId);

    expect(parsedRows).toHaveLength(1);
    expect(parsedRows[0].date).toBeDefined();
    expect(parsedRows[0].date.getUTCFullYear()).toBe(2026);
    expect(parsedRows[0].date.getUTCMonth()).toBe(2); // March is index 2
    expect(parsedRows[0].date.getUTCDate()).toBe(14);
  });

  test('should detect DUPLICATE_ROW', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-01-15,Groceries,1500,INR,Aisha,EQUAL,,\n" +
      "2026-01-15,Groceries,1500,INR,Aisha,EQUAL,,";

    const { anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const dup = anomalies.find(a => a.issueType === 'DUPLICATE_ROW');
    expect(dup).toBeDefined();
    expect(dup.rowIndex).toBe(3); // First row is header, second is row 2, third is row 3
  });

  test('should detect NEGATIVE_AMOUNT', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-01-15,Refund,-500,INR,Aisha,EQUAL,,";

    const { anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const neg = anomalies.find(a => a.issueType === 'NEGATIVE_AMOUNT');
    expect(neg).toBeDefined();
  });

  test('should detect SETTLEMENT_AS_EXPENSE', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-01-15,Aisha paid back Rohan,500,INR,Aisha,EXACT,Rohan:500,";

    const { parsedRows, anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const setl = anomalies.find(a => a.issueType === 'SETTLEMENT_AS_EXPENSE');
    expect(setl).toBeDefined();
    expect(parsedRows[0].isSettlement).toBe(true);
  });

  test('should detect CURRENCY_MISMATCH and convert USD', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-01-15,Netflix,$10,USD,Aisha,EQUAL,,";

    const { parsedRows, anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const curr = anomalies.find(a => a.issueType === 'CURRENCY_MISMATCH');
    expect(curr).toBeDefined();
    expect(parsedRows[0].currency).toBe('USD');
    // 10 * 83.50 = 835
    expect(parsedRows[0].amountInINR).toBe(835);
  });

  test('should detect DOLLAR_AS_RUPEE when currency column is empty/INR', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-01-15,Spotify,$5,INR,Aisha,EQUAL,,";

    const { anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const dollar = anomalies.find(a => a.issueType === 'DOLLAR_AS_RUPEE');
    expect(dollar).toBeDefined();
  });

  test('should detect MEMBER_NOT_IN_GROUP', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-01-15,Dinner,1500,INR,UnknownPayer,EQUAL,,";

    const { anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const member = anomalies.find(a => a.issueType === 'MEMBER_NOT_IN_GROUP');
    expect(member).toBeDefined();
  });

  test('should detect EXPENSE_AFTER_LEAVE', async () => {
    // Meera left end of March 2026. April 2026 expense split with Meera.
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-04-10,Groceries,1200,INR,Aisha,EXACT,\"Aisha:600,Meera:600\",";

    const { anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const leave = anomalies.find(a => a.issueType === 'EXPENSE_AFTER_LEAVE');
    expect(leave).toBeDefined();
  });

  test('should detect EXPENSE_BEFORE_JOIN', async () => {
    // Sam joined mid-April 2026. Feb 2026 expense split with Sam.
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-02-10,Internet,1200,INR,Aisha,EXACT,\"Aisha:600,Sam:600\",";

    const { anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const join = anomalies.find(a => a.issueType === 'EXPENSE_BEFORE_JOIN');
    expect(join).toBeDefined();
  });

  test('should detect MISSING_FIELDS', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      ",Missing Date,1200,INR,Aisha,EQUAL,,";

    const { parsedRows, anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const missing = anomalies.find(a => a.issueType === 'MISSING_FIELDS');
    expect(missing).toBeDefined();
    expect(parsedRows[0].shouldSkip).toBe(true);
  });

  test('should detect INVALID_DATE', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "Invalid-Date-Here,Coffee,120,INR,Aisha,EQUAL,,";

    const { parsedRows, anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const date = anomalies.find(a => a.issueType === 'INVALID_DATE');
    expect(date).toBeDefined();
    expect(parsedRows[0].shouldSkip).toBe(true);
  });

  test('should detect PERCENTAGE_NOT_100', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-02-22,Groceries,2500,INR,Aisha,PERCENTAGE,Aisha:50,Rohan:40,"; // Sums to 90%

    const { parsedRows, anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const pct = anomalies.find(a => a.issueType === 'PERCENTAGE_NOT_100');
    expect(pct).toBeDefined();
    expect(parsedRows[0].shouldSkip).toBe(true);
  });

  test('should detect EXACT_MISMATCH', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-02-23,Groceries,1000,INR,Aisha,EXACT,Aisha:400,Rohan:400,"; // Sums to 800

    const { parsedRows, anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const exact = anomalies.find(a => a.issueType === 'EXACT_MISMATCH');
    expect(exact).toBeDefined();
    expect(parsedRows[0].shouldSkip).toBe(true);
  });

  test('should detect ZERO_AMOUNT', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-02-24,Zero Exp,0,INR,Aisha,EQUAL,,";

    const { anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const zero = anomalies.find(a => a.issueType === 'ZERO_AMOUNT');
    expect(zero).toBeDefined();
  });

  test('should detect NAME_VARIANT and normalize', async () => {
    const csvString = 
      "Date,Description,Amount,Currency,PaidBy,SplitType,SplitDetails,Notes\n" +
      "2026-02-25,Groceries,1500,INR,aisha,EQUAL,,"; // "aisha" in lowercase

    const { parsedRows, anomalies } = await parseAndAnalyzeCSV(csvString, groupId);
    const variant = anomalies.find(a => a.issueType === 'NAME_VARIANT');
    expect(variant).toBeDefined();
    expect(parsedRows[0].paidByName).toBe('Aisha'); // Normalized to canonical
  });
});
