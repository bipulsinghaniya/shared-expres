/**
 * Currency conversion service.
 * Uses a fixed USD → INR rate stored in the environment variable USD_TO_INR_RATE.
 * This avoids live API dependency and ensures reproducible imports.
 */

const DEFAULT_RATE = 83.5;

/**
 * Get the configured USD to INR exchange rate.
 * @returns {number}
 */
function getExchangeRate() {
  const rate = parseFloat(process.env.USD_TO_INR_RATE);
  return isNaN(rate) ? DEFAULT_RATE : rate;
}

/**
 * Convert an amount to INR.
 * @param {number} amount - The original amount.
 * @param {string} currency - 'INR' or 'USD'.
 * @returns {{ amountInINR: number, exchangeRate: number }}
 */
function convertToINR(amount, currency) {
  const curr = (currency || 'INR').toUpperCase().trim();

  if (curr === 'INR') {
    return { amountInINR: amount, exchangeRate: 1 };
  }

  if (curr === 'USD') {
    const rate = getExchangeRate();
    const amountInINR = Math.round(amount * rate * 100) / 100;
    return { amountInINR, exchangeRate: rate };
  }

  // Unsupported currency — treat as INR and flag
  console.warn(`⚠️ Unsupported currency "${curr}", treating as INR`);
  return { amountInINR: amount, exchangeRate: 1 };
}

module.exports = { convertToINR, getExchangeRate };
