import { createContext, useContext, useState, useEffect } from 'react';
import { calcNetPay } from './utils/tax';

const KEY = 'budget_v1';

function uid() { return Math.random().toString(36).slice(2, 9); }
function today() { return new Date().toISOString().slice(0, 10); }

const DEFAULT_ACCOUNTS = [
  { id: 'main',      name: 'Savings',   balance: 0 },
  { id: 'emergency', name: 'Emergency', balance: 0 },
  { id: 'travel',    name: 'Travel',    balance: 0 },
];

const defaults = {
  people:          [],
  expenses:        [],
  fortnightlyData: {},   // { [year]: { fortnights: { [idx]: { adhocTransactions:[] } } } }
  goals:           [],
  wishlist:        [],
  settings:        { currentBalance: 0 },  // kept for legacy compat only
  accounts:        DEFAULT_ACCOUNTS,
  transfers:       [],   // { id, date, fromId, toId, amount, note }
  assetIncomes:    [],   // { id, name, type, amount, frequency, notes }
};

function migrate(saved) {
  // Ensure accounts array exists
  if (!saved.accounts || !Array.isArray(saved.accounts) || saved.accounts.length === 0) {
    saved.accounts = DEFAULT_ACCOUNTS.map(a => ({ ...a }));
  }
  // If all accounts are zero but legacy currentBalance exists, migrate it
  const allZero = saved.accounts.every(a => (a.balance || 0) === 0);
  if (allZero && saved.settings?.currentBalance > 0) {
    saved.accounts = saved.accounts.map((a, i) =>
      i === 0 ? { ...a, balance: saved.settings.currentBalance } : a
    );
  }
  if (!saved.transfers)    saved.transfers    = [];
  if (!saved.assetIncomes) saved.assetIncomes = [];
  if (!saved.goals)        saved.goals        = [];
  if (!saved.wishlist)     saved.wishlist     = [];
  // Ensure incomeEvents on each person
  if (saved.people) {
    saved.people = saved.people.map(p =>
      p.incomeEvents ? p : { ...p, incomeEvents: [] }
    );
  }
  return saved;
}

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults;
      const saved = { ...defaults, ...JSON.parse(raw) };
      return migrate(saved);
    } catch { return defaults; }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const set = (key, val) => setState(s => ({ ...s, [key]: val }));

  const updateFortnight = (year, idx, data) => {
    setState(s => {
      const yd = s.fortnightlyData[year] || { fortnights: {} };
      return {
        ...s,
        fortnightlyData: {
          ...s.fortnightlyData,
          [year]: {
            ...yd,
            fortnights: {
              ...yd.fortnights,
              [idx]: { ...(yd.fortnights[idx] || { adhocTransactions: [] }), ...data },
            },
          },
        },
      };
    });
  };

  const updateAccount = (id, balance) => {
    setState(s => ({
      ...s,
      accounts: s.accounts.map(a => a.id === id ? { ...a, balance: +balance } : a),
    }));
  };

  const addTransfer = ({ fromId, toId, amount, note = '' }) => {
    const amt = +amount;
    if (!amt || amt <= 0) return;
    setState(s => {
      const tx = { id: uid(), date: today(), fromId, toId, amount: amt, note };
      return {
        ...s,
        transfers: [...s.transfers, tx],
        accounts: s.accounts.map(a =>
          a.id === fromId ? { ...a, balance: (a.balance || 0) - amt } :
          a.id === toId   ? { ...a, balance: (a.balance || 0) + amt } : a
        ),
      };
    });
  };

  const removeTransfer = (txId) => {
    setState(s => {
      const tx = s.transfers.find(t => t.id === txId);
      if (!tx) return s;
      return {
        ...s,
        transfers: s.transfers.filter(t => t.id !== txId),
        accounts: s.accounts.map(a =>
          a.id === tx.fromId ? { ...a, balance: (a.balance || 0) + tx.amount } :
          a.id === tx.toId   ? { ...a, balance: (a.balance || 0) - tx.amount } : a
        ),
      };
    });
  };

  // Legacy stub — no longer writes startingBalance
  const setYearBalance = () => {};

  return (
    <Ctx.Provider value={{ state, set, updateFortnight, updateAccount, addTransfer, removeTransfer, setYearBalance }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);

// ── Derived helpers ────────────────────────────────────────────────────────

export function totalBalance(accounts) {
  return (accounts || []).reduce((s, a) => s + (a.balance || 0), 0);
}

function secondaryIncomeFn(secondaryIncomes) {
  return (secondaryIncomes || []).reduce((s, si) => {
    if (si.frequency === 'fortnightly') return s + (si.amount || 0);
    if (si.frequency === 'weekly')      return s + (si.amount || 0) * 2;
    if (si.frequency === 'monthly')     return s + ((si.amount || 0) * 12) / 26;
    if (si.frequency === 'quarterly')   return s + ((si.amount || 0) * 4) / 26;
    if (si.frequency === 'annual')      return s + (si.amount || 0) / 26;
    return s;
  }, 0);
}

export function calcFortnightlyIncome(people) {
  return (people || []).reduce((sum, p) => {
    const net = calcNetPay(p).netFortnightly;
    return sum + net + secondaryIncomeFn(p.secondaryIncomes);
  }, 0);
}

/**
 * Returns the applicable grossAnnual for a person at a given date,
 * considering any income events defined on the person.
 */
export function getPersonIncomeAt(person, date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const active = (person.incomeEvents || [])
    .filter(e => new Date(e.startDate) <= d && (!e.endDate || new Date(e.endDate) > d))
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  return active.length > 0
    ? { grossAnnual: active[0].grossAnnual, eventLabel: active[0].label }
    : { grossAnnual: person.grossAnnual, eventLabel: null };
}

/**
 * Date-aware version of calcFortnightlyIncome — applies income events.
 */
export function calcFortnightlyIncomeAt(people, date) {
  return (people || []).reduce((sum, p) => {
    const { grossAnnual } = getPersonIncomeAt(p, date);
    const net = calcNetPay({ ...p, grossAnnual }).netFortnightly;
    return sum + net + secondaryIncomeFn(p.secondaryIncomes);
  }, 0);
}

export function calcFortnightlyAssetIncome(assetIncomes) {
  return (assetIncomes || []).reduce((sum, a) => {
    const amt = +a.amount || 0;
    if (a.frequency === 'fortnightly') return sum + amt;
    if (a.frequency === 'weekly')      return sum + amt * 2;
    if (a.frequency === 'monthly')     return sum + (amt * 12) / 26;
    if (a.frequency === 'quarterly')   return sum + (amt * 4) / 26;
    if (a.frequency === 'annual')      return sum + amt / 26;
    return sum;
  }, 0);
}

export function calcFortnightlyExpenses(expenses) {
  return (expenses || []).reduce((sum, e) => {
    const a = e.amount || 0;
    if (e.frequency === 'fortnightly') return sum + a;
    if (e.frequency === 'weekly')      return sum + a * 2;
    if (e.frequency === 'monthly')     return sum + (a * 12) / 26;
    if (e.frequency === 'annual')      return sum + a / 26;
    if (e.frequency === 'quarterly')   return sum + (a * 4) / 26;
    return sum;
  }, 0);
}

/**
 * Monday-aligned fortnights. Finds first Monday on/after Jan 1 of the year,
 * then advances by idx * 14 days.
 */
export function getFortnight(year, idx) {
  const jan1 = new Date(year, 0, 1);
  const dow = jan1.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysToMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  const firstMonday = new Date(year, 0, 1 + daysToMonday);
  const start = new Date(firstMonday);
  start.setDate(start.getDate() + idx * 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  return { start, end };
}

export function buildSavingsTrajectory(state) {
  const { people, expenses, fortnightlyData, accounts, assetIncomes } = state;
  const fnExpenses    = calcFortnightlyExpenses(expenses);
  const fnAssetIncome = calcFortnightlyAssetIncome(assetIncomes);

  const allYears = [2025, 2026, 2027, 2028, 2029, 2030];
  const now = new Date();

  // Build all rows with per-fortnight net (balance filled in next)
  // Income is date-aware: income events affect individual fortnights
  const rows = [];
  for (const year of allYears) {
    const yd = fortnightlyData[year] || { fortnights: {} };
    for (let i = 0; i < 26; i++) {
      const ft = (yd.fortnights || {})[i] || { adhocTransactions: [] };
      const adhoc = (ft.adhocTransactions || []).reduce((s, t) => s + (t.amount || 0), 0);
      const { start, end } = getFortnight(year, i);
      const midDate = new Date((start.getTime() + end.getTime()) / 2);
      const fnIncomeAt = calcFortnightlyIncomeAt(people, midDate) + fnAssetIncome;
      rows.push({ date: start.toISOString().slice(0, 10), actual: fnIncomeAt - fnExpenses + adhoc, balance: 0, year, idx: i, start, end });
    }
  }

  // Anchor today's fortnight to the real account balance so past and future
  // fortnights are projected relative to what the user actually has right now.
  let anchorIdx = rows.findIndex(r => now >= r.start && now <= r.end);
  if (anchorIdx < 0) {
    // Outside all fortnights (gap between years): use nearest future fortnight
    anchorIdx = rows.findIndex(r => r.start > now);
    if (anchorIdx < 0) anchorIdx = rows.length - 1;
  }

  const currentBal = totalBalance(accounts);
  rows[anchorIdx].balance = currentBal;
  for (let i = anchorIdx + 1; i < rows.length; i++)
    rows[i].balance = rows[i - 1].balance + rows[i].actual;
  for (let i = anchorIdx - 1; i >= 0; i--)
    rows[i].balance = rows[i + 1].balance - rows[i + 1].actual;

  return rows.map(r => ({ date: r.date, balance: Math.round(r.balance * 100) / 100, year: r.year, idx: r.idx }));
}
