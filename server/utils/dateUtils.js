/**
 * Utility functions for date parsing and validation.
 */

/**
 * Attempt to parse a date string in multiple common formats.
 * Returns a valid Date object or null if unparseable.
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Try DD/MM/YYYY and DD-MM-YYYY first to avoid native parser interpreting them as MM-DD-YYYY
  const ddmmyyyy = trimmed.match(
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/
  );
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
    if (!isNaN(d.getTime())) return d;
  }

  // Try MM/DD/YYYY or MM-DD-YYYY (if somehow specified, but we default to DD-MM-YYYY above)
  const mmddyyyy = trimmed.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
  );
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
    if (!isNaN(d.getTime())) return d;
  }

  // Try MMM-DD (like Mar-14) or MMM DD
  const mmmdd = trimmed.match(/^([A-Za-z]{3})[\/\-\.\s](\d{1,2})$/i);
  if (mmmdd) {
    const [, month, day] = mmmdd;
    const d = new Date(`${day}-${month}-2026`);
    if (!isNaN(d.getTime())) {
      // Force to UTC to avoid timezone shifts
      return new Date(Date.UTC(2026, d.getMonth(), d.getDate()));
    }
  }

  // Try DD-MMM (like 14-Mar) or DD MMM
  const ddmmm = trimmed.match(/^(\d{1,2})[\/\-\.\s]([A-Za-z]{3})$/i);
  if (ddmmm) {
    const [, day, month] = ddmmm;
    const d = new Date(`${day}-${month}-2026`);
    if (!isNaN(d.getTime())) {
      return new Date(Date.UTC(2026, d.getMonth(), d.getDate()));
    }
  }

  // Native parsing fallback (handles ISO 8601 "YYYY-MM-DD", etc.)
  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) {
    // If it's a valid date, make sure it is set to UTC/midnight to avoid local offset issues
    return new Date(Date.UTC(native.getFullYear(), native.getMonth(), native.getDate()));
  }

  return null;
}

/**
 * Check if a date falls within a member's active period.
 * @param {Date} date
 * @param {Date} joinDate
 * @param {Date|null} leaveDate
 * @returns {boolean}
 */
function isDateInMemberPeriod(date, joinDate, leaveDate) {
  const d = new Date(date);
  const join = new Date(joinDate);

  if (d < join) return false;
  if (leaveDate) {
    const leave = new Date(leaveDate);
    if (d > leave) return false;
  }
  return true;
}

/**
 * Format a date to YYYY-MM-DD string.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

module.exports = { parseDate, isDateInMemberPeriod, formatDate };
