const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const ImportLog = require('../models/ImportLog');
const Expense = require('../models/Expense');
const { parseAndAnalyzeCSV } = require('../services/csvImporter');

const router = express.Router();

// Configure multer for CSV uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// ---------------------------------------------------------------------------
// POST /api/groups/:groupId/import — upload and analyze a CSV
// ---------------------------------------------------------------------------
router.post('/:groupId/import', auth, upload.single('file'), async (req, res, next) => {
  try {
    const { groupId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a CSV file' });
    }

    // Verify group
    const group = await Group.findById(groupId);
    if (!group) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Group not found' });
    }

    // Read the file
    const csvString = fs.readFileSync(req.file.path, 'utf-8');

    // Analyze it
    const { parsedRows, anomalies, summary } = await parseAndAnalyzeCSV(
      csvString,
      groupId
    );

    // Save the import log
    const importLog = await ImportLog.create({
      groupId,
      uploadedBy: req.user.userId,
      fileName: req.file.originalname,
      totalRows: summary.totalRows,
      successCount: summary.successCount,
      errorCount: summary.errorCount,
      skippedCount: summary.skippedCount,
      anomalies,
      parsedRows,
    });

    // Clean up the physical file
    fs.unlinkSync(req.file.path);

    res.status(201).json({ importLog, summary });
  } catch (error) {
    // Attempt to clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:groupId/import — list past imports
// ---------------------------------------------------------------------------
router.get('/:groupId/import', auth, async (req, res, next) => {
  try {
    const logs = await ImportLog.findByGroup(req.params.groupId);
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:groupId/import/:importId — get specific import details
// ---------------------------------------------------------------------------
router.get('/:groupId/import/:importId', auth, async (req, res, next) => {
  try {
    const log = await ImportLog.findByIdAndGroup(req.params.importId, req.params.groupId);
    if (!log) {
      return res.status(404).json({ message: 'Import log not found' });
    }
    res.json({ log });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups/:groupId/import/:importId/confirm — execute the import
// ---------------------------------------------------------------------------
router.post('/:groupId/import/:importId/confirm', auth, async (req, res, next) => {
  try {
    const { groupId, importId } = req.params;
    const { resolutions } = req.body; // Array of updated anomaly objects

    const log = await ImportLog.findByIdAndGroup(importId, groupId);
    if (!log) {
      return res.status(404).json({ message: 'Import log not found' });
    }

    if (log.isConfirmed) {
      return res.status(400).json({ message: 'This import has already been confirmed' });
    }

    // 1. Apply user resolutions to the parsed rows
    let rowsToImport = [...log.parsedRows];
    let userSkippedCount = 0;

    if (resolutions && Array.isArray(resolutions)) {
      for (const res of resolutions) {
        const row = rowsToImport.find((r) => r.rowIndex === res.rowIndex);
        if (row) {
          if (res.action === 'SKIP') {
            row.shouldSkip = true;
          } else if (res.action === 'APPROVE') {
            // Remove the specific flag that caused the block
            if (row.flags) {
              row.flags.shouldSkip = false;
            }
            row.shouldSkip = false;
          }
        }
      }
    }

    // 2. Filter out skipped rows
    const validRows = rowsToImport.filter((r) => !r.shouldSkip);
    userSkippedCount = rowsToImport.length - validRows.length;

    // 3. Create actual Expenses in DB
    const importedExpenses = [];
    for (const rowData of validRows) {
      const expenseData = {
        groupId,
        description: rowData.description,
        amount: rowData.amount,
        currency: rowData.currency,
        amountInINR: rowData.amountInINR,
        exchangeRateUsed: rowData.exchangeRateUsed,
        date: rowData.date,
        paidBy: rowData.paidBy,
        splitType: rowData.splitType,
        splits: rowData.splitDetails.map(s => ({
          userId: s.userId,
          amount: s.value
        })),
        isSettlement: rowData.isSettlement,
        importRowIndex: rowData.rowIndex,
        notes: rowData.notes,
      };

      const expense = await Expense.create(expenseData);
      importedExpenses.push(expense);
    }

    // 4. Mark import as confirmed
    await ImportLog.update(importId, {
      isConfirmed: true,
      successCount: validRows.length,
      skippedCount: userSkippedCount,
      anomalies: resolutions || log.anomalies,
    });

    res.json({
      message: `Successfully imported ${validRows.length} expenses`,
      importedCount: validRows.length,
      skippedCount: userSkippedCount,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
