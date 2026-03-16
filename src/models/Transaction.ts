/**
 * @fileoverview Canonical internal money-movement model.
 *
 * Transaction is a unified, read-only representation of any financial event
 * across all domains (finance, investment, property). It is never persisted —
 * domain models (Expense, Dividend, etc.) remain the source of truth.
 *
 * Adapter functions map each domain record into a Transaction.
 */

import type { Expense } from './Expense';
import type { AssetIncome } from './Person';

// ── Direction constants ───────────────────────────────────────────────────────

export const TX_DIRECTION = {
  INFLOW:   'inflow',
  OUTFLOW:  'outflow',
  TRANSFER: 'transfer',
} as const;

export type TxDirection = typeof TX_DIRECTION[keyof typeof TX_DIRECTION];

// ── Type constants ────────────────────────────────────────────────────────────

export const TX_TYPE = {
  EXPENSE:      'expense',
  INCOME:       'income',
  CONTRIBUTION: 'contribution',
  DIVIDEND:     'dividend',
  TRANSFER:     'transfer',
  ASSET_INCOME: 'asset_income',
} as const;

export type TxType = typeof TX_TYPE[keyof typeof TX_TYPE];

// ── Domain constants ──────────────────────────────────────────────────────────

export const TX_DOMAIN = {
  FINANCE:    'finance',
  INVESTMENT: 'investment',
  PROPERTY:   'property',
} as const;

export type TxDomain = typeof TX_DOMAIN[keyof typeof TX_DOMAIN];

// ── Transaction interface ─────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  date: string | null;
  amount: number;
  direction: TxDirection;
  type: TxType;
  domain: TxDomain;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  targetEntityType: string | null;
  targetEntityId: string | null;
  category: string | null;
  notes: string | null;
  createdAt: string | null;
  frequency?: string | null;
}

export interface DividendTransaction extends Transaction {
  grossAmount: number;
  taxAmount: number;
}

// ── Private helper ────────────────────────────────────────────────────────────

function toNum(val: any): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

// ── Adapter functions ─────────────────────────────────────────────────────────

export function transactionFromExpense(expense: Expense): Transaction {
  return {
    id:               expense.id   ?? '',
    date:             expense.startDate || null,
    amount:           toNum(expense.amount),
    direction:        TX_DIRECTION.OUTFLOW,
    type:             TX_TYPE.EXPENSE,
    domain:           TX_DOMAIN.FINANCE,
    sourceEntityType: null,
    sourceEntityId:   expense.forPerson || null,
    targetEntityType: null,
    targetEntityId:   null,
    category:         expense.category ?? null,
    notes:            expense.notes    || null,
    createdAt:        null,
    frequency:        expense.frequency ?? null,
  };
}

export interface Transfer {
  id: string;
  date: string;
  fromId: string;
  toId: string;
  amount: number;
  note: string;
}

export function transactionFromTransfer(transfer: Transfer): Transaction {
  return {
    id:               transfer.id   ?? '',
    date:             transfer.date ?? null,
    amount:           toNum(transfer.amount),
    direction:        TX_DIRECTION.TRANSFER,
    type:             TX_TYPE.TRANSFER,
    domain:           TX_DOMAIN.FINANCE,
    sourceEntityType: 'account',
    sourceEntityId:   transfer.fromId ?? null,
    targetEntityType: 'account',
    targetEntityId:   transfer.toId   ?? null,
    category:         null,
    notes:            transfer.note  || null,
    createdAt:        null,
  };
}

export function transactionFromAssetIncome(assetIncome: AssetIncome): Transaction {
  return {
    id:               assetIncome.id        ?? '',
    date:             null,
    amount:           toNum(assetIncome.amount),
    direction:        TX_DIRECTION.INFLOW,
    type:             TX_TYPE.ASSET_INCOME,
    domain:           TX_DOMAIN.FINANCE,
    sourceEntityType: null,
    sourceEntityId:   null,
    targetEntityType: null,
    targetEntityId:   null,
    category:         assetIncome.type      || null,
    notes:            assetIncome.notes     || null,
    createdAt:        null,
    frequency:        assetIncome.frequency || null,
  };
}
