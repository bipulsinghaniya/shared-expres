/**
 * Name normalisation utility.
 * Handles case-insensitive matching, whitespace trimming, and common variants.
 */

/**
 * Normalise a name to a canonical lowercase, trimmed form.
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Find the canonical name from a list of known names.
 * Returns the original-case canonical name if a match is found, otherwise null.
 * @param {string} rawName - The name to look up.
 * @param {string[]} canonicalNames - Array of correctly-cased canonical names.
 * @returns {{ canonical: string, wasVariant: boolean } | null}
 */
function findCanonicalName(rawName, canonicalNames) {
  if (!rawName) return null;

  const normalised = normalizeName(rawName);

  // 1. Exact match (case insensitive)
  for (const canonical of canonicalNames) {
    if (normalizeName(canonical) === normalised) {
      const wasVariant = canonical !== rawName.trim();
      return { canonical, wasVariant };
    }
  }

  // 2. Fuzzy match: check if raw name starts with canonical name followed by space/initials
  for (const canonical of canonicalNames) {
    const normCanonical = normalizeName(canonical);
    if (normalised.startsWith(normCanonical + ' ') || normalised.startsWith(normCanonical + '.')) {
      return { canonical, wasVariant: true };
    }
    // Check if canonical name starts with raw name (at least 3 characters)
    if (normCanonical.startsWith(normalised) && normalised.length >= 3) {
      return { canonical, wasVariant: true };
    }
  }

  return null;
}

module.exports = { normalizeName, findCanonicalName };
