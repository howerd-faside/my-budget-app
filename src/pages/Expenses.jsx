import { useState, useMemo } from 'react';
import { useApp, calcFortnightlyExpenses } from '../store';
import { fmtMoney, fmtMoneyRound } from '../utils/tax';
import { toFortnightly, annualInterestToFortnightly } from '../utils/finance/frequency';
import { createExpense, createFacility, FREQUENCIES, PAYMENT_METHODS } from '../models/Expense';
import { EXPENSE_GROUPS, CATEGORIES, getCatColor, getCatGroup } from '../utils/categories';
import Icon from '../components/Icon';
import Portal from '../components/Portal';
import { validate, expenseSchema, loanExpenseSchema } from '../utils/validation';

// FREQUENCIES and PAYMENT_METHODS now imported from the Expense model.
const PAYMENT_TYPES = PAYMENT_METHODS; // local alias kept for backward compat with JSX below
const DD_DAYS       = Array.from({ length: 28 }, (_, i) => i + 1);
const TODAY_STR     = new Date().toISOString().slice(0, 10);

function uid() { return Math.random().toString(36).slice(2, 9); }

const EMPTY          = createExpense();
const EMPTY_FACILITY = createFacility();

// ── Helpers ────────────────────────────────────────────────────────────────
// Thin wrappers kept for local readability; logic lives in utils/finance/frequency.js
const toFn         = (e) => toFortnightly(e.amount, e.frequency);
const facToFn      = (f) => toFortnightly(f.amount, f.frequency || 'fortnightly');
const facInterestFn = (f) => annualInterestToFortnightly(f.balance, f.rate);

function fixedExpiryStatus(expiry) {
  if (!expiry) return null;
  const exp    = new Date(expiry + '-01');
  const today  = new Date();
  const months = (exp.getFullYear() - today.getFullYear()) * 12 + exp.getMonth() - today.getMonth();
  if (months < 0)  return 'expired';
  if (months <= 6) return 'soon';
  return 'ok';
}

function normalizeLegacyExpense(e) {
  if (e.type === 'fixed' || e.type === 'variable') {
    return { ...e, subtype: e.type, type: 'standard' };
  }
  return { ...e, subtype: e.subtype ?? 'fixed', type: e.type ?? 'standard', facilities: e.facilities ?? [], forPerson: e.forPerson ?? '' };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Expenses() {
  const { state, set }  = useApp();
  const [editing, setEditing]             = useState(null);
  const [form, setForm]                   = useState(EMPTY);
  const [errors, setErrors]               = useState({});
  const [expandedRows, setExpandedRows]   = useState(new Set());
  const [filterGroup, setFilterGroup]     = useState('All');
  const [archiveOpen, setArchiveOpen]     = useState(false);

  const expenses = useMemo(() => state.expenses.map(normalizeLegacyExpense), [state.expenses]);

  // Split active vs archived based on endDate
  const activeExpenses = useMemo(
    () => expenses.filter(e => !e.endDate || e.endDate >= TODAY_STR),
    [expenses]
  );
  const archivedExpenses = useMemo(
    () => [...expenses.filter(e => e.endDate && e.endDate < TODAY_STR)]
           .sort((a, b) => b.endDate.localeCompare(a.endDate)),
    [expenses]
  );

  const totalFn  = calcFortnightlyExpenses(activeExpenses);

  // Per-category fortnightly totals (active only)
  const catTotals = useMemo(() => {
    const t = {};
    activeExpenses.forEach(e => { t[e.category] = (t[e.category] || 0) + toFn(e); });
    return t;
  }, [activeExpenses]);

  // Per-group totals (legacy/unknown categories bucketed into 'other')
  const groupTotals = useMemo(() => {
    const t = {};
    EXPENSE_GROUPS.forEach(g => {
      t[g.id] = g.cats.reduce((s, c) => s + (catTotals[c] || 0), 0);
    });
    Object.keys(catTotals).forEach(cat => {
      if (!CATEGORIES.includes(cat)) t['other'] = (t['other'] || 0) + (catTotals[cat] || 0);
    });
    return t;
  }, [catTotals]);

  // Filtered expenses by group (active only)
  const filtered = useMemo(() => {
    if (filterGroup === 'All') return activeExpenses;
    const g = EXPENSE_GROUPS.find(g => g.id === filterGroup);
    if (!g) return activeExpenses;
    return activeExpenses.filter(e => g.cats.includes(e.category));
  }, [activeExpenses, filterGroup]);

  // Expenses organised by group for grouped rendering (active only)
  const groupedFiltered = useMemo(() => {
    if (filterGroup !== 'All') return null; // flat list when filtered
    return EXPENSE_GROUPS.map(g => ({
      ...g,
      items: activeExpenses.filter(e => g.cats.includes(e.category)),
    })).filter(g => g.items.length > 0);
  }, [activeExpenses, filterGroup]);

  // ── Row expand ─────────────────────────────────────────────────────────
  const toggleRow = (id, e) => {
    if (e.target.closest('button')) return;
    setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── Loan helpers ───────────────────────────────────────────────────────
  const facilitiesTotalFn = (facs) => (facs || []).reduce((s, f) => s + facToFn(f), 0);

  // ── Modal helpers ──────────────────────────────────────────────────────
  const openNew  = () => { setForm({ ...EMPTY, id: uid() }); setEditing('new'); setErrors({}); };
  const openEdit = (e, ev) => { ev.stopPropagation(); setForm(normalizeLegacyExpense(e)); setEditing(e.id); setErrors({}); };
  const close    = () => { setEditing(null); setForm(EMPTY); setErrors({}); };

  const addFacility    = () => setForm(f => ({ ...f, facilities: [...f.facilities, { ...EMPTY_FACILITY, id: uid() }] }));
  const updateFacility = (id, field, val) => setForm(f => ({
    ...f, facilities: f.facilities.map(fac => fac.id === id ? { ...fac, [field]: val } : fac),
  }));
  const removeFacility = (id) => setForm(f => ({ ...f, facilities: f.facilities.filter(fac => fac.id !== id) }));

  const save = () => {
    const schema = form.type === 'loan' ? loanExpenseSchema : expenseSchema;
    const { ok, errors: errs } = validate(schema, form);
    if (!ok) { setErrors(errs); return; }
    setErrors({});

    let expense = { ...form, ddDay: form.ddDay ? +form.ddDay : null };
    if (form.type === 'loan') {
      expense = { ...expense, amount: facilitiesTotalFn(form.facilities), frequency: 'fortnightly' };
    } else {
      expense = { ...expense, amount: +form.amount };
    }
    if (editing === 'new') {
      set('expenses', [...state.expenses, expense]);
    } else {
      const existing = state.expenses.find(e => e.id === form.id);
      if (existing && +existing.amount !== +expense.amount) {
        expense.history = [...(existing.history || []),
          { date: new Date().toISOString().slice(0, 10), oldAmount: existing.amount, newAmount: expense.amount }];
      }
      set('expenses', state.expenses.map(e => e.id === form.id ? expense : e));
    }
    close();
  };

  const remove = (id, e) => {
    e.stopPropagation();
    if (confirm('Remove this expense?')) set('expenses', state.expenses.filter(e => e.id !== id));
  };

  const previewFn = form.type === 'loan' ? facilitiesTotalFn(form.facilities) : toFn(form);

  // ── Render helpers ──────────────────────────────────────────────────────
  const renderExpenseRow = (e, opts = {}) => {
    const isLoan     = e.type === 'loan';
    const isSpending = e.category === 'Spending Money';
    const isOpen     = expandedRows.has(e.id);
    const fn         = toFn(e);
    const catColor   = isSpending ? '#30d158' : getCatColor(e.category);
    const isArchived = opts.archived ?? false;

    return (
      <div key={e.id} className={`expense-row ${isLoan ? 'loan-row' : ''} ${isOpen ? 'expanded' : ''} ${isArchived ? 'archived-row' : ''}`}
        onClick={ev => toggleRow(e.id, ev)}>
        <div className="exp-cat-bar" style={{ background: catColor }} />
        <div className="exp-main">
          <div className="exp-top">
            <div className="exp-info">
              <span className="exp-name">
                {isSpending && e.forPerson && (
                  <span className="spending-avatar">{e.forPerson[0]?.toUpperCase()}</span>
                )}
                {e.name}
                {isLoan && <span className="loan-badge">LOAN</span>}
                {isArchived && <span className="loan-badge" style={{ background: 'var(--text3)' }}>ENDED</span>}
              </span>
              <span className="exp-tags">
                {isSpending ? (
                  <>
                    {e.forPerson && <span className="tag green">{e.forPerson}</span>}
                    <span className="tag green">Spending Money</span>
                    <span className="tag">{e.frequency}</span>
                  </>
                ) : (
                  <>
                    <span className="tag">{e.category}</span>
                    {isLoan && e.lender && <span className="tag teal">{e.lender}</span>}
                    {isLoan && <span className="tag">{(e.facilities || []).length} split{(e.facilities || []).length !== 1 ? 's' : ''}</span>}
                    {!isLoan && <span className="tag">{e.frequency}</span>}
                    {!isLoan && e.paymentMethod && <span className="tag">{e.paymentMethod}</span>}
                    {!isLoan && e.ddDay && <span className="tag teal">DD day {e.ddDay}</span>}
                    {!isLoan && (e.subtype === 'variable' || e.type === 'variable') && <span className="tag amber">variable</span>}
                  </>
                )}
                {e.startDate && <span className="tag">from {e.startDate.slice(0, 7)}</span>}
                {e.endDate && <span className="tag">until {e.endDate.slice(0, 7)}</span>}
              </span>
            </div>
            <div className="exp-right">
              <div className="exp-amounts">
                {!isLoan ? (
                  <>
                    <span className="exp-amount red">
                      {fmtMoney(e.amount)}
                      <span className="exp-freq">/{e.frequency === 'fortnightly' ? 'fn' : e.frequency.slice(0, 2)}</span>
                    </span>
                    <span className="exp-fn">{fmtMoneyRound(fn)}/fn</span>
                  </>
                ) : (
                  <span className="exp-amount red">{fmtMoneyRound(fn)}/fn</span>
                )}
              </div>
              <div className="exp-actions">
                <button className="btn-icon" onClick={ev => openEdit(e, ev)}><Icon name="pencil" /></button>
                <button className="btn-icon danger" onClick={ev => remove(e.id, ev)}><Icon name="trash" /></button>
              </div>
            </div>
          </div>

          {/* Inline expanded detail */}
          {isOpen && (
            <div className="exp-detail">
              {e.notes && (
                <div className="exp-detail-notes">{e.notes}</div>
              )}

              {/* Standard expense details */}
              {!isLoan && (
                <div className="exp-detail-grid">
                  {e.paymentMethod && !isSpending && (
                    <div className="edg-item">
                      <span className="edg-label">Payment</span>
                      <span className="edg-val">{e.paymentMethod}{e.ddDay ? ` — day ${e.ddDay}` : ''}</span>
                    </div>
                  )}
                  <div className="edg-item">
                    <span className="edg-label">Monthly</span>
                    <span className="edg-val mono">{fmtMoneyRound(fn * 26 / 12)}</span>
                  </div>
                  <div className="edg-item">
                    <span className="edg-label">Annual</span>
                    <span className="edg-val mono">{fmtMoneyRound(fn * 26)}</span>
                  </div>
                </div>
              )}

              {/* Loan facilities inline */}
              {isLoan && (
                <div className="facility-list">
                  {(e.facilities || []).map(f => {
                    const status = f.rateType === 'fixed' ? fixedExpiryStatus(f.fixedTermExpiry) : null;
                    const intFn  = facInterestFn(f);
                    const repFn  = facToFn(f);
                    return (
                      <div key={f.id} className={`facility-row${status === 'expired' ? ' fac-expired' : status === 'soon' ? ' fac-expiring' : ''}`}>
                        <div className="fac-left">
                          <span className={`fac-type-dot ${f.rateType}`} />
                          <div className="fac-info">
                            <span className="fac-label">{f.label || `${f.rateType} facility`}</span>
                            <span className="fac-meta">
                              {f.balance ? `$${Number(f.balance).toLocaleString('en-NZ')} ` : ''}
                              {f.rate ? `@ ${f.rate}% p.a.` : ''}
                              {f.rateType === 'fixed' && f.fixedTermExpiry ? ` · fixed to ${f.fixedTermExpiry}` : ''}
                              {status === 'expired' ? ' · expired' : status === 'soon' ? ' · expiring soon' : ''}
                              {` · ${f.repaymentType}`}
                            </span>
                          </div>
                        </div>
                        <div className="fac-right">
                          <span className="fac-repay">{fmtMoneyRound(repFn)}/fn</span>
                          {f.balance && f.rate && (
                            <span className="fac-interest">~{fmtMoneyRound(intFn)} int.</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="fac-total-row">
                    <span>Total repayment</span>
                    <span className="fac-repay red">{fmtMoneyRound(fn)}/fn</span>
                  </div>
                </div>
              )}

              {/* Change history */}
              {(e.history || []).length > 0 && (
                <div className="change-history">
                  <div className="ch-label">Change History</div>
                  {(e.history || []).map((h, i) => (
                    <div key={i} className="ch-row">
                      <span className="ch-date">{h.date}</span>
                      <span className="ch-change">
                        <span className="red">{fmtMoney(h.oldAmount)}</span>
                        <span className="ch-arrow">→</span>
                        <span className="green">{fmtMoney(h.newAmount)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-content">
      {activeExpenses.length > 0 && (
        <div className="dash-section">
          <div className="section-header">
            <h3>Spending Breakdown</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="text3" style={{ fontSize: 11 }}>{fmtMoneyRound(totalFn * 26)}/yr</span>
              <button className="btn-ghost small" onClick={openNew}>+ Add Expense</button>
            </div>
          </div>

          {/* Summary tiles */}
          <div className="fn-summary">
            <div className="fns-item">
              <span>Fortnightly</span>
              <span className="mono red">{fmtMoneyRound(totalFn)}</span>
            </div>
            <div className="fns-item">
              <span>Monthly</span>
              <span className="mono">{fmtMoneyRound(totalFn * 26 / 12)}</span>
            </div>
            <div className="fns-item">
              <span>Annual</span>
              <span className="mono">{fmtMoneyRound(totalFn * 26)}</span>
            </div>
          </div>

          {/* Proportion bar */}
          <div className="cat-proportion-wrap">
            <div className="cat-proportion">
              {EXPENSE_GROUPS.map(g => {
                const amt = groupTotals[g.id] || 0;
                if (!amt) return null;
                return (
                  <div key={g.id} className="cp-segment" title={`${g.label}: ${fmtMoneyRound(amt)}/fn`}
                    style={{ flex: amt, background: g.color }} />
                );
              })}
            </div>
            <div className="cat-legend">
              {EXPENSE_GROUPS.map(g => {
                const amt = groupTotals[g.id] || 0;
                if (!amt) return null;
                return (
                  <div key={g.id}
                    className={`cl-item ${filterGroup === g.id ? 'active' : ''}`}
                    onClick={() => setFilterGroup(filterGroup === g.id ? 'All' : g.id)}>
                    <div className="cl-dot" style={{ background: g.color }} />
                    <span className="cl-icon">{g.icon}</span>
                    <span className="cl-label">{g.label}</span>
                    <span className="cl-amt">{fmtMoneyRound(amt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Group filter tabs */}
      {activeExpenses.length > 0 && (
        <div className="filter-tabs">
          <button className={`filter-tab ${filterGroup === 'All' ? 'active' : ''}`}
            onClick={() => setFilterGroup('All')}>All</button>
          {EXPENSE_GROUPS.filter(g => (groupTotals[g.id] || 0) > 0).map(g => (
            <button key={g.id}
              className={`filter-tab ${filterGroup === g.id ? 'active' : ''}`}
              onClick={() => setFilterGroup(filterGroup === g.id ? 'All' : g.id)}
              style={filterGroup === g.id ? { borderColor: g.color, color: g.color, background: g.color + '1a' } : {}}>
              {g.icon} {g.label}
            </button>
          ))}
        </div>
      )}

      {/* Expense list / card grid */}
      {groupedFiltered ? (
        <div className="exp-group-grid">
          {groupedFiltered.map(g => (
            <div key={g.id} className="exp-group-card">
              <div className="egc-header" style={{ borderTopColor: g.color }}>
                <span className="egc-icon">{g.icon}</span>
                <div className="egc-title">
                  <span className="egc-label">{g.label}</span>
                  <span className="egc-count">{g.items.length} item{g.items.length !== 1 ? 's' : ''}</span>
                </div>
                <span className="egc-total">
                  {fmtMoneyRound(groupTotals[g.id])}<span className="egc-per">/fn</span>
                </span>
              </div>
              <div className="egc-items">
                {g.items.map(e => renderExpenseRow(e))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="expense-list">
          {filtered.map(e => renderExpenseRow(e))}
        </div>
      )}

      {expenses.length === 0 && (
        <div className="empty-state">
          <div className="es-icon">💸</div>
          <div className="es-text">No expenses yet — add bills, loans and regular costs</div>
          <button className="btn-primary" onClick={openNew}>Add your first expense</button>
        </div>
      )}

      {/* ── ARCHIVED EXPENSES ── */}
      {archivedExpenses.length > 0 && (
        <div className="dash-section" style={{ marginTop: 16 }}>
          <div className="section-header"
            style={{ cursor: 'pointer' }}
            onClick={() => setArchiveOpen(o => !o)}>
            <h3 style={{ color: 'var(--text3)', fontWeight: 500 }}>
              Archived Expenses
              <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 6 }}>· {archivedExpenses.length}</span>
            </h3>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: archiveOpen ? 'rotate(180deg)' : '', transition: 'transform 0.2s', color: 'var(--text3)' }}>
              <path d="M4 6l4 4 4-4"/>
            </svg>
          </div>
          {archiveOpen && (
            <div className="expense-list" style={{ opacity: 0.75 }}>
              {archivedExpenses.map(e => renderExpenseRow(e, { archived: true }))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Expense button when empty ── */}
      {expenses.length > 0 && activeExpenses.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="btn-ghost small" onClick={openNew}>+ Add Expense</button>
        </div>
      )}

      {/* ── MODAL ── */}
      {editing && (
        <Portal>
        <div className="modal-overlay" onClick={close}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing === 'new' ? 'Add Expense' : 'Edit Expense'}</h3>
              <button className="btn-icon" onClick={close}><Icon name="close" /></button>
            </div>
            <div className="modal-body">

              {/* Expense type selector */}
              <div className="exp-type-sel">
                <button className={`ets-btn ${form.type === 'standard' ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'standard', category: f.category === 'Spending Money' ? 'Groceries' : f.category }))}>
                  Regular Expense
                </button>
                <button className={`ets-btn ${form.category === 'Spending Money' ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'standard', category: 'Spending Money', frequency: 'fortnightly', subtype: 'fixed', paymentMethod: 'Bank Transfer' }))}>
                  Spending Money
                </button>
                <button className={`ets-btn ${form.type === 'loan' ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'loan', category: f.category === 'Groceries' || f.category === 'Spending Money' ? 'Mortgage' : f.category }))}>
                  Loan / Mortgage
                </button>
              </div>

              {/* ── SPENDING MONEY ── */}
              {form.category === 'Spending Money' && form.type !== 'loan' && (
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Label</label>
                    <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. Billy's Spending Money" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    {errors.name && <span className="field-error">{errors.name}</span>}
                  </div>
                  <div className="form-group">
                    <label>For Person</label>
                    <input className="input" placeholder="e.g. Billy" value={form.forPerson}
                      onChange={e => setForm(f => ({ ...f, forPerson: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Amount ($)</label>
                    <input className={`input mono${errors.amount ? ' input-error' : ''}`} type="number" step="0.01" placeholder="0.00" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                    {errors.amount && <span className="field-error">{errors.amount}</span>}
                  </div>
                  <div className="form-group">
                    <label>Frequency</label>
                    <select className="input" value={form.frequency}
                      onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                      {FREQUENCIES.map(fr => <option key={fr}>{fr}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Start Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                    <input className="input" type="date" value={form.startDate || ''}
                      onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>End Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                    <input className="input" type="date" value={form.endDate || ''}
                      onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                  <div className="form-group full">
                    <label>Notes</label>
                    <input className="input" placeholder="Optional details" value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* ── STANDARD EXPENSE ── */}
              {form.type !== 'loan' && form.category !== 'Spending Money' && (
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Expense Name</label>
                    <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. Power — Contact Energy" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    {errors.name && <span className="field-error">{errors.name}</span>}
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select className="input" value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {EXPENSE_GROUPS.filter(g => g.id !== 'personal').map(g => (
                        <optgroup key={g.id} label={`${g.icon} ${g.label}`}>
                          {g.cats.map(c => <option key={c}>{c}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select className="input" value={form.subtype}
                      onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))}>
                      <option value="fixed">Fixed</option>
                      <option value="variable">Variable (estimate)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount ($)</label>
                    <input className={`input mono${errors.amount ? ' input-error' : ''}`} type="number" step="0.01" placeholder="0.00" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                    {errors.amount && <span className="field-error">{errors.amount}</span>}
                  </div>
                  <div className="form-group">
                    <label>Frequency</label>
                    <select className="input" value={form.frequency}
                      onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                      {FREQUENCIES.map(fr => <option key={fr}>{fr}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Payment Method</label>
                    <select className="input" value={form.paymentMethod}
                      onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                      {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  {form.paymentMethod === 'Direct Debit' && (
                    <div className="form-group">
                      <label>DD Day of Month</label>
                      <select className="input" value={form.ddDay}
                        onChange={e => setForm(f => ({ ...f, ddDay: e.target.value }))}>
                        <option value="">— Select —</option>
                        {DD_DAYS.map(d => (
                          <option key={d} value={d}>{d}{d===1?'st':d===2?'nd':d===3?'rd':'th'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Start Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                    <input className="input" type="date" value={form.startDate || ''}
                      onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>End Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                    <input className="input" type="date" value={form.endDate || ''}
                      onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                  <div className="form-group full">
                    <label>Notes</label>
                    <input className="input" placeholder="Optional details" value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* ── LOAN / MORTGAGE ── */}
              {form.type === 'loan' && (
                <>
                  <div className="form-grid">
                    <div className="form-group full">
                      <label>Loan Name</label>
                      <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. ANZ Home Loan" value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                      {errors.name && <span className="field-error">{errors.name}</span>}
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select className="input" value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                        <option value="Mortgage">Mortgage</option>
                        <option value="Vehicle Loan">Vehicle Loan</option>
                        <option value="Personal Loan">Personal Loan</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Lender</label>
                      <input className="input" placeholder="e.g. ANZ, ASB, Kiwibank" value={form.lender}
                        onChange={e => setForm(f => ({ ...f, lender: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Start Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                      <input className="input" type="date" value={form.startDate || ''}
                        onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>End Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                      <input className="input" type="date" value={form.endDate || ''}
                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                    </div>
                    <div className="form-group full">
                      <label>Notes</label>
                      <input className="input" placeholder="Optional" value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>

                  {/* Facilities */}
                  <div className="facilities-section">
                    <div className="fac-section-header">
                      <span className="form-section-label">Loan Splits / Facilities</span>
                      <button className="btn-ghost small" onClick={addFacility}>+ Add Split</button>
                    </div>
                    {errors.facilities && <span className="field-error" style={{ marginBottom: 6 }}>{errors.facilities}</span>}

                    {form.facilities.length === 0 && (
                      <div className="fac-empty">Add splits to track each fixed/floating portion separately</div>
                    )}

                    {form.facilities.map((fac, idx) => {
                      const intFn = facInterestFn(fac);
                      return (
                        <div key={fac.id} className="fac-form-card">
                          <div className="fac-form-header">
                            <div className="fac-form-title">
                              <span className={`fac-type-dot ${fac.rateType}`} />
                              <span className="fac-form-num">Split {idx + 1}</span>
                              {fac.rateType && <span className="fac-form-type">{fac.rateType}</span>}
                            </div>
                            <button className="btn-icon danger small" onClick={() => removeFacility(fac.id)}><Icon name="close" size={12} /></button>
                          </div>
                          <div className="form-grid">
                            <div className="form-group full">
                              <label>Label</label>
                              <input className="input" placeholder="e.g. Fixed Rate — Main" value={fac.label}
                                onChange={e => updateFacility(fac.id, 'label', e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label>Outstanding Balance ($)</label>
                              <input className="input mono" type="number" placeholder="0" value={fac.balance}
                                onChange={e => updateFacility(fac.id, 'balance', e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label>Interest Rate (% p.a.)</label>
                              <input className="input mono" type="number" step="0.01" placeholder="6.85" value={fac.rate}
                                onChange={e => updateFacility(fac.id, 'rate', e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label>Rate Type</label>
                              <select className="input" value={fac.rateType}
                                onChange={e => updateFacility(fac.id, 'rateType', e.target.value)}>
                                <option value="fixed">Fixed</option>
                                <option value="floating">Floating</option>
                                <option value="revolving">Revolving Credit</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Repayment Type</label>
                              <select className="input" value={fac.repaymentType}
                                onChange={e => updateFacility(fac.id, 'repaymentType', e.target.value)}>
                                <option value="P&I">Principal &amp; Interest</option>
                                <option value="IO">Interest Only</option>
                              </select>
                            </div>
                            {fac.rateType === 'fixed' && (
                              <div className="form-group">
                                <label>Fixed Term Expiry</label>
                                <input className="input" type="month" value={fac.fixedTermExpiry}
                                  onChange={e => updateFacility(fac.id, 'fixedTermExpiry', e.target.value)} />
                              </div>
                            )}
                            <div className="form-group">
                              <label>Fortnightly Repayment ($)</label>
                              <input className="input mono" type="number" step="0.01" placeholder="0.00" value={fac.amount}
                                onChange={e => updateFacility(fac.id, 'amount', e.target.value)} />
                            </div>
                            {fac.balance && fac.rate && (
                              <div className="form-group">
                                <label>Est. Interest component/fn</label>
                                <div className="input fac-calc-preview">
                                  <span className="red">{fmtMoneyRound(intFn)}</span>
                                  {fac.repaymentType === 'P&I' && fac.amount && (
                                    <span className="text3"> · principal ~{fmtMoneyRound(Math.max(0, facToFn(fac) - intFn))}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Live preview */}
              {previewFn > 0 && (
                <div className="calc-preview">
                  <span>Fortnightly: <strong className="red">{fmtMoneyRound(previewFn)}</strong></span>
                  <span>Monthly: <strong>{fmtMoneyRound(previewFn * 26 / 12)}</strong></span>
                  <span>Annual: <strong>{fmtMoneyRound(previewFn * 26)}</strong></span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
