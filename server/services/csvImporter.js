/**
 * CSV Importer Service
 * ====================
 * Core module for parsing CSV files, running 14 anomaly detectors,
 * and producing a structured import report for user review.
 *
 * Main export: parseAndAnalyzeCSV(csvString, groupId)
 * Returns: { parsedRows, anomalies, summary }
 */

const Papa = require('papaparse');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');
const { parseDate, isDateInMemberPeriod } = require('../utils/dateUtils');
const { normalizeName, findCanonicalName } = require('../utils/nameNormalizer');
const { convertToINR } = require('../services/currencyConverter');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SETTLEMENT_KEYWORDS = /\b(settle|settled|settlement|paid\s*back|reimburse|reimbursed|reimbursement|payback|pay\s*back)\b/i;

// ---------------------------------------------------------------------------
// Helper: extract numeric amount and detect currency symbols in raw string
// ---------------------------------------------------------------------------

/**
 * Parse a raw amount string and extract numeric value + currency hints.
 * Examples:
 *   "1500"      → { value: 1500, hasDollarSign: false }
 *   "$45"       → { value: 45,   hasDollarSign: true  }
 *   "₹1200"     → { value: 1200, hasDollarSign: false }
 *   "-200"      → { value: -200, hasDollarSign: false }
 *   "USD 30"    → { value: 30,   hasDollarSign: true  }
 *
 * @param {string} raw
 * @returns {{ value: number|null, hasDollarSign: boolean, raw: string }}
 */
function parseAmount(raw) {
  if (raw === undefined || raw === null) {
    return { value: null, hasDollarSign: false, raw: String(raw) };
  }

  const str = String(raw).trim();
  if (str === '') {
    return { value: null, hasDollarSign: false, raw: str };
  }

  // Detect dollar indicators
  const hasDollarSign =
    str.includes('$') ||
    str.toUpperCase().includes('USD');

  // Strip currency symbols, commas, spaces to extract the number
  const cleaned = str
    .replace(/[$₹,]/g, '')
    .replace(/USD|INR/gi, '')
    .trim();

  const value = parseFloat(cleaned);

  return {
    value: isNaN(value) ? null : value,
    hasDollarSign,
    raw: str,
  };
}

// ---------------------------------------------------------------------------
// Helper: parse the SplitDetails column
// ---------------------------------------------------------------------------

/**
 * Parse the SplitDetails column.
 * Expected formats:
 *   EXACT:      "Aisha:500,Rohan:300,Priya:200"
 *   PERCENTAGE: "Aisha:40,Rohan:30,Priya:30"
 *   SHARES:     "Aisha:2,Rohan:1,Priya:1"
 *   EQUAL:      "" (empty — split equally among active members)
 *
 * @param {string} raw
 * @returns {Array<{ name: string, value: number }>}
 */
function parseSplitDetails(raw) {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }

  // Split by semicolon or comma
  const parts = raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
  const result = [];

  for (const part of parts) {
    // Match name, separator (colon or space), numeric value, and optional % sign
    const match = part.match(/^(.*?)\s*[:\s]\s*(-?[\d.]+)\s*%?$/);
    if (match) {
      const name = match[1].trim();
      const value = parseFloat(match[2]);
      if (name && !isNaN(value)) {
        result.push({ name, value });
      }
    }
  }

  return result;
}

function parseSplitWith(raw) {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }
  // Split by semicolon or comma
  return raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// 14 Anomaly Detectors
// Each detector receives the current row context and may push anomalies
// and/or modify the processed row object.
// ---------------------------------------------------------------------------

/**
 * Detector 1: DUPLICATE_ROW
 * Same date + description + amount + payer → flag as duplicate.
 */
function detectDuplicate(ctx) {
  const { row, rowIndex, seenHashes, anomalies } = ctx;
  const dateStr = String(row.date || '').trim();
  const desc = normalizeName(row.description || '');
  const amt = String(row.parsedAmount.value ?? '');
  const payer = normalizeName(row.paidBy || '');

  const hash = `${dateStr}|${desc}|${amt}|${payer}`;

  if (seenHashes.has(hash)) {
    anomalies.push({
      rowIndex,
      issueType: 'DUPLICATE_ROW',
      description: `Duplicate of a previous row with same date (${dateStr}), description ("${row.description}"), amount (${amt}), and payer ("${row.paidBy}")`,
      rawRow: row.raw,
      suggestedAction: 'Flag as duplicate — keep one copy. User should approve which to keep or reject this row.',
      status: 'pending',
    });
    row.flags.isDuplicate = true;
  }

  seenHashes.set(hash, rowIndex);
}

/**
 * Detector 2: NEGATIVE_AMOUNT
 * Amount < 0 → flag as potential refund.
 */
function detectNegativeAmount(ctx) {
  const { row, rowIndex, anomalies } = ctx;
  if (row.parsedAmount.value !== null && row.parsedAmount.value < 0) {
    anomalies.push({
      rowIndex,
      issueType: 'NEGATIVE_AMOUNT',
      description: `Negative amount (${row.parsedAmount.value}) — may be a refund or data entry error`,
      rawRow: row.raw,
      suggestedAction: 'Confirm if this is a refund. If approved, import as negative expense; if rejected, skip row.',
      status: 'pending',
    });
    row.flags.isNegative = true;
  }
}

/**
 * Detector 3: SETTLEMENT_AS_EXPENSE
 * Description contains settlement keywords → re-classify as isSettlement.
 */
function detectSettlement(ctx) {
  const { row, rowIndex, anomalies } = ctx;
  const desc = row.description || '';

  if (SETTLEMENT_KEYWORDS.test(desc)) {
    anomalies.push({
      rowIndex,
      issueType: 'SETTLEMENT_AS_EXPENSE',
      description: `Description "${desc}" contains settlement keywords — should be classified as a settlement, not a regular expense`,
      rawRow: row.raw,
      suggestedAction: 'Re-classify as settlement (isSettlement = true). Settlements adjust balances directly without splitting.',
      status: 'pending',
    });
    row.processed.isSettlement = true;
  }
}

/**
 * Detector 4: CURRENCY_MISMATCH
 * Amount has $ sign AND Currency column explicitly says USD → auto-convert.
 */
function detectCurrencyMismatch(ctx) {
  const { row, rowIndex, anomalies } = ctx;
  const rawCurrency = (row.currency || '').trim().toUpperCase();
  const hasDollar = row.parsedAmount.hasDollarSign;

  if (hasDollar && rawCurrency === 'USD') {
    // Dollar sign in amount + Currency column says USD: legitimate USD entry.
    // Auto-convert and log it.
    anomalies.push({
      rowIndex,
      issueType: 'CURRENCY_MISMATCH',
      description: `Amount "${row.parsedAmount.raw}" has dollar indicator and Currency is USD — will convert to INR using stored exchange rate`,
      rawRow: row.raw,
      suggestedAction: 'Auto-convert USD to INR using the configured exchange rate.',
      status: 'pending',
    });
    row.processed.currency = 'USD';
    row.processed.needsConversion = true;
  }
}

/**
 * Detector 5: DOLLAR_AS_RUPEE
 * Amount has $ sign but Currency column is empty, missing, or says INR →
 * the dollar amount is being treated as rupees. Flag for user review.
 */
function detectDollarAsRupee(ctx) {
  const { row, rowIndex, anomalies } = ctx;
  const rawCurrency = (row.currency || '').trim().toUpperCase();
  const hasDollar = row.parsedAmount.hasDollarSign;

  // Only fire if detector 4 didn't already handle it
  if (hasDollar && rawCurrency !== 'USD') {
    anomalies.push({
      rowIndex,
      issueType: 'DOLLAR_AS_RUPEE',
      description: `Amount "${row.parsedAmount.raw}" contains a dollar sign but Currency column is "${row.currency || '(empty)'}" — this dollar amount may be incorrectly treated as rupees`,
      rawRow: row.raw,
      suggestedAction: 'Review: if this is USD, approve to convert to INR. If it is INR with a typo, reject the conversion.',
      status: 'pending',
    });
    row.flags.dollarAsRupee = true;
    // Tentatively mark as USD for conversion if approved
    row.processed.currency = 'USD';
    row.processed.needsConversion = true;
  }
}

/**
 * Detector 6: MEMBER_NOT_IN_GROUP
 * Payer (or anyone in splits) not found in the group's member list.
 */
function detectMemberNotInGroup(ctx) {
  const { row, rowIndex, anomalies, memberNameMap } = ctx;
  const payerName = row.processed.normalizedPayer || row.paidBy || '';
  const normalizedPayer = normalizeName(payerName);

  if (normalizedPayer && !memberNameMap.has(normalizedPayer)) {
    anomalies.push({
      rowIndex,
      issueType: 'MEMBER_NOT_IN_GROUP',
      description: `Payer "${payerName}" is not a member of this group`,
      rawRow: row.raw,
      suggestedAction: `Add "${payerName}" as a new member of the group, or correct the name if it's a typo.`,
      status: 'pending',
    });
    row.flags.unknownPayer = true;
  }

  // Also check split detail names
  if (row.splitDetailsParsed && row.splitDetailsParsed.length > 0) {
    for (const split of row.splitDetailsParsed) {
      const name = split.normalizedName || split.name;
      const normalizedSplitName = normalizeName(name);
      if (normalizedSplitName && !memberNameMap.has(normalizedSplitName)) {
        anomalies.push({
          rowIndex,
          issueType: 'MEMBER_NOT_IN_GROUP',
          description: `Split member "${name}" is not a member of this group`,
          rawRow: row.raw,
          suggestedAction: `Add "${name}" as a new member of the group, or correct the name.`,
          status: 'pending',
        });
      }
    }
  }

  // Also check split_with names
  if (row.processed.normalizedSplitWith && row.processed.normalizedSplitWith.length > 0) {
    for (const name of row.processed.normalizedSplitWith) {
      const normalizedSplitName = normalizeName(name);
      if (normalizedSplitName && !memberNameMap.has(normalizedSplitName)) {
        anomalies.push({
          rowIndex,
          issueType: 'MEMBER_NOT_IN_GROUP',
          description: `Split member "${name}" is not a member of this group`,
          rawRow: row.raw,
          suggestedAction: `Add "${name}" as a new member of the group, or correct the name.`,
          status: 'pending',
        });
      }
    }
  }
}

/**
 * Detector 7: EXPENSE_AFTER_LEAVE
 * Expense date is after a member's leave date.
 */
function detectExpenseAfterLeave(ctx) {
  const { row, rowIndex, anomalies, memberNameMap } = ctx;
  if (!row.processed.parsedDate) return;

  const expenseDate = row.processed.parsedDate;
  const payerName = normalizeName(row.paidBy || '');
  const payerInfo = memberNameMap.get(payerName);

  // Check the payer
  if (payerInfo && payerInfo.leaveDate) {
    const leaveDate = new Date(payerInfo.leaveDate);
    if (expenseDate > leaveDate) {
      anomalies.push({
        rowIndex,
        issueType: 'EXPENSE_AFTER_LEAVE',
        description: `Payer "${row.paidBy}" left the group on ${leaveDate.toISOString().split('T')[0]}, but this expense is dated ${expenseDate.toISOString().split('T')[0]}`,
        rawRow: row.raw,
        suggestedAction: `Exclude "${row.paidBy}" from this expense or adjust the date. The member was not active at the time.`,
        status: 'pending',
      });
      row.flags.payerAfterLeave = true;
    }
  }

  // Check split members
  if (row.splitDetailsParsed && row.splitDetailsParsed.length > 0) {
    for (const split of row.splitDetailsParsed) {
      const splitName = normalizeName(split.name);
      const splitInfo = memberNameMap.get(splitName);
      if (splitInfo && splitInfo.leaveDate) {
        const leaveDate = new Date(splitInfo.leaveDate);
        if (expenseDate > leaveDate) {
          anomalies.push({
            rowIndex,
            issueType: 'EXPENSE_AFTER_LEAVE',
            description: `Split member "${split.name}" left the group on ${leaveDate.toISOString().split('T')[0]}, but this expense is dated ${expenseDate.toISOString().split('T')[0]}`,
            rawRow: row.raw,
            suggestedAction: `Exclude "${split.name}" from the split for this expense.`,
            status: 'pending',
          });
        }
      }
    }
  }

  // Check split_with members
  if (row.processed.normalizedSplitWith && row.processed.normalizedSplitWith.length > 0) {
    for (const name of row.processed.normalizedSplitWith) {
      const splitName = normalizeName(name);
      const splitInfo = memberNameMap.get(splitName);
      if (splitInfo && splitInfo.leaveDate) {
        const leaveDate = new Date(splitInfo.leaveDate);
        if (expenseDate > leaveDate) {
          anomalies.push({
            rowIndex,
            issueType: 'EXPENSE_AFTER_LEAVE',
            description: `Split member "${name}" left the group on ${leaveDate.toISOString().split('T')[0]}, but this expense is dated ${expenseDate.toISOString().split('T')[0]}`,
            rawRow: row.raw,
            suggestedAction: `Exclude "${name}" from the split for this expense.`,
            status: 'pending',
          });
        }
      }
    }
  }
}

/**
 * Detector 8: EXPENSE_BEFORE_JOIN
 * Expense date is before a member's join date.
 */
function detectExpenseBeforeJoin(ctx) {
  const { row, rowIndex, anomalies, memberNameMap } = ctx;
  if (!row.processed.parsedDate) return;

  const expenseDate = row.processed.parsedDate;
  const payerName = normalizeName(row.paidBy || '');
  const payerInfo = memberNameMap.get(payerName);

  // Check the payer
  if (payerInfo && payerInfo.joinDate) {
    const joinDate = new Date(payerInfo.joinDate);
    if (expenseDate < joinDate) {
      anomalies.push({
        rowIndex,
        issueType: 'EXPENSE_BEFORE_JOIN',
        description: `Payer "${row.paidBy}" joined the group on ${joinDate.toISOString().split('T')[0]}, but this expense is dated ${expenseDate.toISOString().split('T')[0]} (before they joined)`,
        rawRow: row.raw,
        suggestedAction: `Auto-exclude "${row.paidBy}" from this expense. They were not a member yet.`,
        status: 'pending',
      });
      row.flags.payerBeforeJoin = true;
    }
  }

  // Check split members
  if (row.splitDetailsParsed && row.splitDetailsParsed.length > 0) {
    for (const split of row.splitDetailsParsed) {
      const splitName = normalizeName(split.name);
      const splitInfo = memberNameMap.get(splitName);
      if (splitInfo && splitInfo.joinDate) {
        const joinDate = new Date(splitInfo.joinDate);
        if (expenseDate < joinDate) {
          anomalies.push({
            rowIndex,
            issueType: 'EXPENSE_BEFORE_JOIN',
            description: `Split member "${split.name}" joined on ${joinDate.toISOString().split('T')[0]}, but expense is dated ${expenseDate.toISOString().split('T')[0]}`,
            rawRow: row.raw,
            suggestedAction: `Auto-exclude "${split.name}" from the split. They had not joined yet.`,
            status: 'pending',
          });
        }
      }
    }
  }

  // Check split_with members
  if (row.processed.normalizedSplitWith && row.processed.normalizedSplitWith.length > 0) {
    for (const name of row.processed.normalizedSplitWith) {
      const splitName = normalizeName(name);
      const splitInfo = memberNameMap.get(splitName);
      if (splitInfo && splitInfo.joinDate) {
        const joinDate = new Date(splitInfo.joinDate);
        if (expenseDate < joinDate) {
          anomalies.push({
            rowIndex,
            issueType: 'EXPENSE_BEFORE_JOIN',
            description: `Split member "${name}" joined on ${joinDate.toISOString().split('T')[0]}, but expense is dated ${expenseDate.toISOString().split('T')[0]}`,
            rawRow: row.raw,
            suggestedAction: `Auto-exclude "${name}" from the split. They had not joined yet.`,
            status: 'pending',
          });
        }
      }
    }
  }
}

/**
 * Detector 9: MISSING_FIELDS
 * No amount, no date, or no payer → skip row.
 */
function detectMissingFields(ctx) {
  const { row, rowIndex, anomalies } = ctx;
  const missing = [];

  if (row.parsedAmount.value === null) missing.push('Amount');
  if (!row.date || String(row.date).trim() === '') missing.push('Date');
  if (!row.paidBy || String(row.paidBy).trim() === '') missing.push('PaidBy');

  if (missing.length > 0) {
    anomalies.push({
      rowIndex,
      issueType: 'MISSING_FIELDS',
      description: `Missing required field(s): ${missing.join(', ')}`,
      rawRow: row.raw,
      suggestedAction: 'Skip this row — essential data is missing and cannot be inferred.',
      status: 'pending',
    });
    row.flags.missingFields = true;
    row.flags.shouldSkip = true;
  }
}

/**
 * Detector 10: INVALID_DATE
 * Date string cannot be parsed into a valid Date object.
 */
function detectInvalidDate(ctx) {
  const { row, rowIndex, anomalies } = ctx;

  // Only fire if date field is present but unparseable
  const rawDate = row.date ? String(row.date).trim() : '';
  if (!rawDate) return; // Missing date is handled by detector 9

  const parsed = parseDate(rawDate);
  if (!parsed) {
    anomalies.push({
      rowIndex,
      issueType: 'INVALID_DATE',
      description: `Date "${rawDate}" could not be parsed into a valid date`,
      rawRow: row.raw,
      suggestedAction: 'Correct the date format (expected YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY) or skip this row.',
      status: 'pending',
    });
    row.flags.invalidDate = true;
    row.flags.shouldSkip = true;
  } else {
    row.processed.parsedDate = parsed;
  }
}

/**
 * Detector 11: PERCENTAGE_NOT_100
 * For PERCENTAGE split type, percentages must sum to 100.
 */
function detectPercentageNot100(ctx) {
  const { row, rowIndex, anomalies } = ctx;
  const splitType = (row.splitType || '').trim().toUpperCase();

  if (splitType !== 'PERCENTAGE') return;
  if (!row.splitDetailsParsed || row.splitDetailsParsed.length === 0) return;

  const total = row.splitDetailsParsed.reduce((sum, s) => sum + s.value, 0);
  const diff = Math.abs(total - 100);

  if (diff > 0.01) {
    anomalies.push({
      rowIndex,
      issueType: 'PERCENTAGE_NOT_100',
      description: `Percentage splits sum to ${total.toFixed(2)}%, not 100%. Breakdown: ${row.splitDetailsParsed.map((s) => `${s.name}:${s.value}%`).join(', ')}`,
      rawRow: row.raw,
      suggestedAction: 'Fix the percentage values so they sum to exactly 100%, or skip this row.',
      status: 'pending',
    });
    row.flags.percentageMismatch = true;
    row.flags.shouldSkip = true;
  }
}

/**
 * Detector 12: EXACT_MISMATCH
 * For EXACT split type, individual amounts must sum to the total.
 */
function detectExactMismatch(ctx) {
  const { row, rowIndex, anomalies } = ctx;
  const splitType = (row.splitType || '').trim().toUpperCase();

  if (splitType !== 'EXACT') return;
  if (!row.splitDetailsParsed || row.splitDetailsParsed.length === 0) return;

  const splitTotal = row.splitDetailsParsed.reduce((sum, s) => sum + s.value, 0);
  const expenseAmount = row.parsedAmount.value;

  if (expenseAmount === null) return; // Missing amount handled by detector 9

  const diff = Math.abs(splitTotal - expenseAmount);

  if (diff > 0.01) {
    anomalies.push({
      rowIndex,
      issueType: 'EXACT_MISMATCH',
      description: `Exact split amounts sum to ${splitTotal.toFixed(2)}, but expense total is ${expenseAmount.toFixed(2)} (difference: ${diff.toFixed(2)})`,
      rawRow: row.raw,
      suggestedAction: 'Adjust split amounts to match the total, or correct the expense total. Row halted until resolved.',
      status: 'pending',
    });
    row.flags.exactMismatch = true;
    row.flags.shouldSkip = true;
  }
}

/**
 * Detector 13: ZERO_AMOUNT
 * Amount is exactly 0 → flag as suspicious.
 */
function detectZeroAmount(ctx) {
  const { row, rowIndex, anomalies } = ctx;
  if (row.parsedAmount.value === 0) {
    anomalies.push({
      rowIndex,
      issueType: 'ZERO_AMOUNT',
      description: `Amount is zero — this may be a data entry error or placeholder`,
      rawRow: row.raw,
      suggestedAction: 'Confirm if this is intentional. If rejected, skip this row.',
      status: 'pending',
    });
    row.flags.zeroAmount = true;
  }
}

/**
 * Detector 14: NAME_VARIANT
 * Fuzzy name matching against canonical member names.
 * "aisha" vs "Aisha" vs "AISHA" → normalize to canonical form.
 */
function detectNameVariant(ctx) {
  const { row, rowIndex, anomalies, canonicalNames } = ctx;

  // Check payer name
  const payerRaw = (row.paidBy || '').trim();
  if (payerRaw) {
    const match = findCanonicalName(payerRaw, canonicalNames);
    if (match && match.wasVariant) {
      anomalies.push({
        rowIndex,
        issueType: 'NAME_VARIANT',
        description: `Payer name "${payerRaw}" is a variant of canonical name "${match.canonical}" — auto-normalizing`,
        rawRow: row.raw,
        suggestedAction: `Normalize "${payerRaw}" → "${match.canonical}"`,
        status: 'pending',
      });
      row.processed.normalizedPayer = match.canonical;
    } else if (match) {
      row.processed.normalizedPayer = match.canonical;
    }
  }

  // Check split detail names
  if (row.splitDetailsParsed && row.splitDetailsParsed.length > 0) {
    for (const split of row.splitDetailsParsed) {
      const match = findCanonicalName(split.name, canonicalNames);
      if (match && match.wasVariant) {
        anomalies.push({
          rowIndex,
          issueType: 'NAME_VARIANT',
          description: `Split member name "${split.name}" is a variant of "${match.canonical}" — auto-normalizing`,
          rawRow: row.raw,
          suggestedAction: `Normalize "${split.name}" → "${match.canonical}"`,
          status: 'pending',
        });
        split.normalizedName = match.canonical;
      } else if (match) {
        split.normalizedName = match.canonical;
      }
    }
  }

  // Check split_with names
  if (row.splitWithParsed && row.splitWithParsed.length > 0) {
    row.processed.normalizedSplitWith = [];
    for (const name of row.splitWithParsed) {
      const match = findCanonicalName(name, canonicalNames);
      if (match && match.wasVariant) {
        anomalies.push({
          rowIndex,
          issueType: 'NAME_VARIANT',
          description: `Split member name "${name}" is a variant of "${match.canonical}" — auto-normalizing`,
          rawRow: row.raw,
          suggestedAction: `Normalize "${name}" → "${match.canonical}"`,
          status: 'pending',
        });
        row.processed.normalizedSplitWith.push(match.canonical);
      } else if (match) {
        row.processed.normalizedSplitWith.push(match.canonical);
      } else {
        row.processed.normalizedSplitWith.push(name);
      }
    }
  } else {
    row.processed.normalizedSplitWith = [];
  }
}

// ---------------------------------------------------------------------------
// Main: Parse and Analyze CSV
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string and run all 14 anomaly detectors on each row.
 *
 * @param {string} csvString - Raw CSV file content.
 * @param {string} groupId - The MongoDB ObjectId of the group.
 * @returns {Promise<{ parsedRows: Array, anomalies: Array, summary: Object }>}
 */
async function parseAndAnalyzeCSV(csvString, groupId) {
  // -----------------------------------------------------------------------
  // Step 1: Fetch group members and build lookup maps
  // -----------------------------------------------------------------------
  const members = await GroupMember.getAllMembers(groupId);

  // memberNameMap: normalized name → { userId, joinDate, leaveDate, canonicalName }
  const memberNameMap = new Map();
  const canonicalNames = [];

  for (const member of members) {
    if (!member.userId) continue;
    const canonicalName = member.userId.name;
    canonicalNames.push(canonicalName);

    memberNameMap.set(normalizeName(canonicalName), {
      userId: member.userId.id,
      joinDate: member.joinDate,
      leaveDate: member.leaveDate,
      canonicalName,
    });
  }

  // -----------------------------------------------------------------------
  // Step 2: Parse CSV with PapaParse
  // -----------------------------------------------------------------------
  const parseResult = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => {
      // Normalize header names to handle variations
      const h = header.trim().toLowerCase();
      const headerMap = {
        'date': 'Date',
        'description': 'Description',
        'desc': 'Description',
        'amount': 'Amount',
        'amt': 'Amount',
        'currency': 'Currency',
        'curr': 'Currency',
        'paidby': 'PaidBy',
        'paid by': 'PaidBy',
        'paid_by': 'PaidBy',
        'payer': 'PaidBy',
        'splittype': 'SplitType',
        'split type': 'SplitType',
        'split_type': 'SplitType',
        'splitwith': 'SplitWith',
        'split with': 'SplitWith',
        'split_with': 'SplitWith',
        'splitdetails': 'SplitDetails',
        'split details': 'SplitDetails',
        'split_details': 'SplitDetails',
        'notes': 'Notes',
        'note': 'Notes',
        'comments': 'Notes',
      };
      return headerMap[h] || header.trim();
    },
  });

  const csvRows = parseResult.data;

  // -----------------------------------------------------------------------
  // Step 3: Process each row through all 14 detectors
  // -----------------------------------------------------------------------
  const anomalies = [];
  const parsedRows = [];
  const seenHashes = new Map(); // For duplicate detection

  for (let i = 0; i < csvRows.length; i++) {
    const csvRow = csvRows[i];
    const rowIndex = i + 2; // +2 because: +1 for 1-indexing, +1 for header row

    // Build enriched row object
    const parsedAmount = parseAmount(csvRow.Amount);
    const splitDetailsParsed = parseSplitDetails(csvRow.SplitDetails);
    const splitWithParsed = parseSplitWith(csvRow.SplitWith);

    const row = {
      // Original CSV values
      date: csvRow.Date,
      description: csvRow.Description,
      amount: csvRow.Amount,
      currency: csvRow.Currency,
      paidBy: csvRow.PaidBy,
      splitType: csvRow.SplitType,
      splitDetails: csvRow.SplitDetails,
      splitWith: csvRow.SplitWith,
      notes: csvRow.Notes,

      // Parsed helpers
      parsedAmount,
      splitDetailsParsed,
      splitWithParsed,

      // Raw CSV row for logging
      raw: { ...csvRow },

      // Flags set by detectors
      flags: {
        isDuplicate: false,
        isNegative: false,
        dollarAsRupee: false,
        unknownPayer: false,
        payerAfterLeave: false,
        payerBeforeJoin: false,
        missingFields: false,
        invalidDate: false,
        percentageMismatch: false,
        exactMismatch: false,
        zeroAmount: false,
        shouldSkip: false,
      },

      // Processed values (may be modified by detectors)
      processed: {
        parsedDate: null,
        currency: (csvRow.Currency || 'INR').trim().toUpperCase() || 'INR',
        needsConversion: false,
        isSettlement: false,
        normalizedPayer: null,
      },
    };

    // Build the detector context
    const ctx = {
      row,
      rowIndex,
      anomalies,
      seenHashes,
      memberNameMap,
      canonicalNames,
    };

    // --- Run detectors in sequence ---
    // Order matters: field-level checks first, then semantic checks

    // 9. Missing fields — run first; if critical fields are missing, many
    //    other detectors would produce misleading results
    detectMissingFields(ctx);

    // 10. Invalid date — parse and validate the date field
    detectInvalidDate(ctx);

    // 14. Name variant — normalize names before member-based checks
    detectNameVariant(ctx);

    // 13. Zero amount
    detectZeroAmount(ctx);

    // 2. Negative amount
    detectNegativeAmount(ctx);

    // 4. Currency mismatch ($ + Currency=USD)
    detectCurrencyMismatch(ctx);

    // 5. Dollar as rupee ($ but no Currency=USD)
    detectDollarAsRupee(ctx);

    // 3. Settlement logged as expense
    detectSettlement(ctx);

    // 1. Duplicate row
    detectDuplicate(ctx);

    // 6. Member not in group
    detectMemberNotInGroup(ctx);

    // 7. Expense after member left
    detectExpenseAfterLeave(ctx);

    // 8. Expense before member joined
    detectExpenseBeforeJoin(ctx);

    // 11. Percentage not 100
    detectPercentageNot100(ctx);

    // 12. Exact mismatch
    detectExactMismatch(ctx);

    // --- Build the final processed row ---
    const processedRow = buildProcessedRow(row, memberNameMap);
    processedRow.rowIndex = rowIndex;
    parsedRows.push(processedRow);
  }

  // -----------------------------------------------------------------------
  // Step 4: Build summary
  // -----------------------------------------------------------------------
  const summary = {
    totalRows: csvRows.length,
    successCount: parsedRows.filter((r) => !r.shouldSkip).length,
    errorCount: parsedRows.filter((r) => r.shouldSkip).length,
    skippedCount: 0, // Updated after user confirmation
    anomalyCount: anomalies.length,
    anomalyBreakdown: {},
  };

  // Count anomalies by type
  for (const a of anomalies) {
    summary.anomalyBreakdown[a.issueType] =
      (summary.anomalyBreakdown[a.issueType] || 0) + 1;
  }

  return { parsedRows, anomalies, summary };
}

// ---------------------------------------------------------------------------
// Helper: Build the final processed row ready for Expense creation
// ---------------------------------------------------------------------------

/**
 * Transform a detector-enriched row into a clean object
 * that can be saved as an Expense document.
 *
 * @param {Object} row - The enriched row from detection.
 * @param {Map} memberNameMap - Normalized name → member info.
 * @returns {Object}
 */
function buildProcessedRow(row, memberNameMap) {
  const currency = row.processed.currency || 'INR';
  let amount = row.parsedAmount.value;
  let amountInINR = amount;
  let exchangeRateUsed = 1;

  // Apply currency conversion if needed
  if (amount !== null && row.processed.needsConversion) {
    const conversion = convertToINR(Math.abs(amount), 'USD');
    amountInINR = row.flags.isNegative ? -conversion.amountInINR : conversion.amountInINR;
    exchangeRateUsed = conversion.exchangeRate;
  } else if (amount !== null) {
    amountInINR = amount;
  }

  // Resolve payer to userId
  const payerName = row.processed.normalizedPayer || (row.paidBy ? row.paidBy.trim() : '');
  const payerInfo = memberNameMap.get(normalizeName(payerName));
  const payerUserId = payerInfo ? payerInfo.userId : null;

  // Resolve split type
  let splitType = (row.splitType || 'EQUAL').trim().toUpperCase();
  if (splitType === 'UNEQUAL') splitType = 'EXACT';
  if (splitType === 'SHARE') splitType = 'SHARES';
  const validSplitTypes = ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'];
  const finalSplitType = validSplitTypes.includes(splitType) ? splitType : 'EQUAL';

  // Resolve split_with names with user IDs
  const resolvedSplitWith = [];
  if (row.processed.normalizedSplitWith && row.processed.normalizedSplitWith.length > 0) {
    for (const name of row.processed.normalizedSplitWith) {
      const info = memberNameMap.get(normalizeName(name));
      resolvedSplitWith.push({
        userId: info ? info.userId : null,
        name: name,
      });
    }
  }

  // Resolve split details with user IDs
  const resolvedSplits = [];
  if (row.splitDetailsParsed && row.splitDetailsParsed.length > 0) {
    for (const split of row.splitDetailsParsed) {
      const name = split.normalizedName || split.name;
      const info = memberNameMap.get(normalizeName(name));
      if (info) {
        resolvedSplits.push({
          userId: info.userId,
          name,
          value: split.value,
        });
      }
    }
  }

  return {
    // Data for Expense creation
    description: (row.description || '').trim(),
    amount: amount !== null ? Math.abs(amount) : 0,
    currency: row.processed.needsConversion ? 'USD' : currency,
    amountInINR: amountInINR !== null ? Math.abs(amountInINR) : 0,
    exchangeRateUsed,
    date: row.processed.parsedDate,
    paidBy: payerUserId,
    paidByName: payerName,
    splitType: finalSplitType,
    splitWith: resolvedSplitWith,
    splitDetails: resolvedSplits,
    isSettlement: row.processed.isSettlement,
    notes: (row.notes || '').trim(),

    // Metadata
    shouldSkip: row.flags.shouldSkip,
    flags: { ...row.flags },
    rawRow: row.raw,
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = {
  parseAndAnalyzeCSV,
  // Exported for unit testing individual detectors
  parseAmount,
  parseSplitDetails,
  detectDuplicate,
  detectNegativeAmount,
  detectSettlement,
  detectCurrencyMismatch,
  detectDollarAsRupee,
  detectMemberNotInGroup,
  detectExpenseAfterLeave,
  detectExpenseBeforeJoin,
  detectMissingFields,
  detectInvalidDate,
  detectPercentageNot100,
  detectExactMismatch,
  detectZeroAmount,
  detectNameVariant,
};
