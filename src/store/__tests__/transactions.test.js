/**
 * Tests for the canonical Transaction model adapters.
 *
 * Covers:
 *   Transaction adapters (src/models/Transaction.ts):
 *     - transactionFromExpense    — maps Expense to outflow Transaction
 *     - transactionFromTransfer   — maps Transfer; captures both sides (source + target)
 *     - transactionFromAssetIncome — maps AssetIncome to inflow Transaction
 */
import { describe, it, expect } from 'vitest';
import {
  TX_DIRECTION, TX_TYPE, TX_DOMAIN,
  transactionFromExpense,
  transactionFromTransfer,
  transactionFromAssetIncome,
} from '../../models/Transaction';

// ── transactionFromExpense ────────────────────────────────────────────────────

describe('transactionFromExpense', () => {
  const expense = {
    id: 'e1', name: 'Rent', category: 'Housing', type: 'standard', subtype: 'fixed',
    amount: 1800, frequency: 'monthly', startDate: '2025-01-01', endDate: '',
    forPerson: 'p1', notes: 'Main rent', paymentMethod: 'Direct Debit',
  };

  it('sets direction to outflow', () => {
    expect(transactionFromExpense(expense).direction).toBe(TX_DIRECTION.OUTFLOW);
  });

  it('sets type to expense', () => {
    expect(transactionFromExpense(expense).type).toBe(TX_TYPE.EXPENSE);
  });

  it('sets domain to finance', () => {
    expect(transactionFromExpense(expense).domain).toBe(TX_DOMAIN.FINANCE);
  });

  it('copies id and amount as a number', () => {
    const tx = transactionFromExpense(expense);
    expect(tx.id).toBe('e1');
    expect(tx.amount).toBe(1800);
    expect(typeof tx.amount).toBe('number');
  });

  it('uses startDate as the transaction date', () => {
    expect(transactionFromExpense(expense).date).toBe('2025-01-01');
  });

  it('sets date to null when startDate is absent', () => {
    expect(transactionFromExpense({ ...expense, startDate: '' }).date).toBeNull();
  });

  it('maps category from expense.category', () => {
    expect(transactionFromExpense(expense).category).toBe('Housing');
  });

  it('retains frequency as a supplemental field', () => {
    expect(transactionFromExpense(expense).frequency).toBe('monthly');
  });

  it('maps forPerson to sourceEntityId', () => {
    expect(transactionFromExpense(expense).sourceEntityId).toBe('p1');
  });

  it('sourceEntityId is null when forPerson is absent', () => {
    expect(transactionFromExpense({ ...expense, forPerson: '' }).sourceEntityId).toBeNull();
  });

  it('targetEntityType and targetEntityId are null (no specific target for expenses)', () => {
    const tx = transactionFromExpense(expense);
    expect(tx.targetEntityType).toBeNull();
    expect(tx.targetEntityId).toBeNull();
  });

  it('coerces string amount to number', () => {
    const tx = transactionFromExpense({ ...expense, amount: '2400' });
    expect(tx.amount).toBe(2400);
    expect(typeof tx.amount).toBe('number');
  });

  it('uses 0 for missing/invalid amount', () => {
    expect(transactionFromExpense({ ...expense, amount: '' }).amount).toBe(0);
    expect(transactionFromExpense({ ...expense, amount: null }).amount).toBe(0);
  });
});

// ── transactionFromTransfer ───────────────────────────────────────────────────

describe('transactionFromTransfer', () => {
  const transfer = {
    id: 't1', date: '2026-01-15', fromId: 'savings', toId: 'emergency',
    amount: 500, note: 'Top up emergency fund',
  };

  it('sets direction to transfer', () => {
    expect(transactionFromTransfer(transfer).direction).toBe(TX_DIRECTION.TRANSFER);
  });

  it('sets type to transfer', () => {
    expect(transactionFromTransfer(transfer).type).toBe(TX_TYPE.TRANSFER);
  });

  it('sets domain to finance', () => {
    expect(transactionFromTransfer(transfer).domain).toBe(TX_DOMAIN.FINANCE);
  });

  it('captures both sides — sourceEntityId (from) and targetEntityId (to)', () => {
    const tx = transactionFromTransfer(transfer);
    expect(tx.sourceEntityType).toBe('account');
    expect(tx.sourceEntityId).toBe('savings');
    expect(tx.targetEntityType).toBe('account');
    expect(tx.targetEntityId).toBe('emergency');
  });

  it('copies amount as a number', () => {
    const tx = transactionFromTransfer(transfer);
    expect(tx.amount).toBe(500);
    expect(typeof tx.amount).toBe('number');
  });

  it('copies date', () => {
    expect(transactionFromTransfer(transfer).date).toBe('2026-01-15');
  });

  it('maps note to notes', () => {
    expect(transactionFromTransfer(transfer).notes).toBe('Top up emergency fund');
  });

  it('coerces string amount to number', () => {
    expect(transactionFromTransfer({ ...transfer, amount: '250' }).amount).toBe(250);
  });

  it('uses 0 for missing amount', () => {
    expect(transactionFromTransfer({ ...transfer, amount: undefined }).amount).toBe(0);
  });
});

// ── transactionFromAssetIncome ────────────────────────────────────────────────

describe('transactionFromAssetIncome', () => {
  const assetIncome = {
    id: 'ai1', name: 'Rental income', type: 'rental',
    amount: 1200, frequency: 'monthly', notes: 'Investment property',
  };

  it('sets direction to inflow', () => {
    expect(transactionFromAssetIncome(assetIncome).direction).toBe(TX_DIRECTION.INFLOW);
  });

  it('sets type to asset_income', () => {
    expect(transactionFromAssetIncome(assetIncome).type).toBe(TX_TYPE.ASSET_INCOME);
  });

  it('sets domain to finance', () => {
    expect(transactionFromAssetIncome(assetIncome).domain).toBe(TX_DOMAIN.FINANCE);
  });

  it('copies amount as a number', () => {
    const tx = transactionFromAssetIncome(assetIncome);
    expect(tx.amount).toBe(1200);
    expect(typeof tx.amount).toBe('number');
  });

  it('date is null (recurring flow has no single event date)', () => {
    expect(transactionFromAssetIncome(assetIncome).date).toBeNull();
  });

  it('maps assetIncome.type (rental/dividend/etc) to category', () => {
    expect(transactionFromAssetIncome(assetIncome).category).toBe('rental');
  });

  it('retains frequency as a supplemental field', () => {
    expect(transactionFromAssetIncome(assetIncome).frequency).toBe('monthly');
  });

  it('sourceEntityId and targetEntityId are null (not linked to a specific entity)', () => {
    const tx = transactionFromAssetIncome(assetIncome);
    expect(tx.sourceEntityId).toBeNull();
    expect(tx.targetEntityId).toBeNull();
  });

  it('coerces string amount to number', () => {
    expect(transactionFromAssetIncome({ ...assetIncome, amount: '800' }).amount).toBe(800);
  });

  it('uses 0 for missing amount', () => {
    expect(transactionFromAssetIncome({ ...assetIncome, amount: null }).amount).toBe(0);
  });
});
