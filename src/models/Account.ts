/**
 * @fileoverview Domain model for a savings/bank account.
 *
 * Inconsistencies detected:
 * - DEFAULT_ACCOUNTS in store.jsx omits `balance` on the 'emergency' and 'travel'
 *   entries (they rely on the `|| 0` fallback in totalBalance). normalizeAccount
 *   ensures balance is always a number.
 */

export interface Account {
  id: string;
  name: string;
  balance: number;
}

/** Pre-defined account IDs used by the default store. */
export const ACCOUNT_IDS = ['main', 'emergency', 'travel'] as const;

/**
 * Factory — returns a blank Account with sensible defaults.
 */
export function createAccount(overrides: Partial<Account> = {}): Account {
  return {
    id:      '',
    name:    '',
    balance: 0,
    ...overrides,
  };
}

/**
 * The three accounts that are provisioned on first launch.
 */
export function createDefaultAccounts(): Account[] {
  return [
    createAccount({ id: 'main',      name: 'Savings',   balance: 0 }),
    createAccount({ id: 'emergency', name: 'Emergency', balance: 0 }),
    createAccount({ id: 'travel',    name: 'Travel',    balance: 0 }),
  ];
}

/**
 * Coerce a raw (possibly legacy) account object to the canonical shape.
 */
export function normalizeAccount(raw: any = {}): Account {
  return createAccount({
    id:      raw.id      ?? '',
    name:    raw.name    ?? '',
    balance: +(raw.balance ?? 0),
  });
}
