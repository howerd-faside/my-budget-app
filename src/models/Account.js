/**
 * @fileoverview Domain model for a savings/bank account.
 *
 * Inconsistencies detected:
 * - DEFAULT_ACCOUNTS in store.jsx omits `balance` on the 'emergency' and 'travel'
 *   entries (they rely on the `|| 0` fallback in totalBalance). normalizeAccount
 *   ensures balance is always a number.
 */

/**
 * @typedef {Object} Account
 * @property {string} id       - Unique identifier (e.g. 'main', 'emergency', 'travel')
 * @property {string} name     - Display name shown in the UI
 * @property {number} balance  - Current balance in NZD (never negative by convention)
 */

/** Pre-defined account IDs used by the default store. */
export const ACCOUNT_IDS = /** @type {const} */ (['main', 'emergency', 'travel']);

/**
 * Factory — returns a blank Account with sensible defaults.
 * @param {Partial<Account>} overrides
 * @returns {Account}
 */
export function createAccount(overrides = {}) {
  return {
    id:      '',
    name:    '',
    balance: 0,
    ...overrides,
  };
}

/**
 * The three accounts that are provisioned on first launch.
 * @returns {Account[]}
 */
export function createDefaultAccounts() {
  return [
    createAccount({ id: 'main',      name: 'Savings',   balance: 0 }),
    createAccount({ id: 'emergency', name: 'Emergency', balance: 0 }),
    createAccount({ id: 'travel',    name: 'Travel',    balance: 0 }),
  ];
}

/**
 * Coerce a raw (possibly legacy) account object to the canonical shape.
 * @param {object} raw
 * @returns {Account}
 */
export function normalizeAccount(raw = {}) {
  return createAccount({
    id:      raw.id      ?? '',
    name:    raw.name    ?? '',
    balance: +(raw.balance ?? 0),
  });
}
