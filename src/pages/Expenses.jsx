import { useState, useMemo } from 'react';
import { useApp, calcFortnightlyExpenses } from '../store';
import { fmtMoney, fmtMoneyRound } from '../utils/tax';
import { EXPENSE_GROUPS, CATEGORIES, getCatColor, getCatGroup } from '../utils/categories';
import Icon from '../components/Icon';

const FREQUENCIES   = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'];
const PAYMENT_TYPES = ['Direct Debit', 'Credit Card', 'Bank Transfer', 'Auto-Pay', 'Cash'];
const DD_DAYS       = Array.from({ length: 28 }, (_, i) => i + 1);

function uid() { return Math.random().toString(36).slice(2, 9); }

const EMPTY = {
  id: '', name: '', category: 'Groceries',
  type: 'standard', subtype: 'fixed',
  amount: '', frequency: 'monthly',
  paymentMethod: 'Direct Debit', ddDay: '',
  lender: '', facilities: [],
  notes: '', history: [],
};

const EMPTY_FACILITY = {
  id: '', label: '', balance: '', rate: '',
  rateType: 'fixed', repaymentType: 'P&I',
  fixedTermExpiry: '', amount: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function toFn(e) {
  const a = +e.amount || 0;
  if (e.frequency === 'fortnightly') return a;
  if (e.frequency === 'weekly')      return a * 2;
  if (e.frequency === 'monthly')     return (a * 12) / 26;
  if (e.frequency === 'quarterly')   return (a * 4)  / 26;
  if (e.frequency === 'annual')      return a / 26;
  return a;
}

function facToFn(f) {
  const a = +f.amount || 0;
  if (!f.frequency || f.frequency === 'fortnightly') return a;
  if (f.frequency === 'weekly')  return a * 2;
  if (f.frequency === 'monthly') return (a * 12) / 26;
  return a;
}

function facInterestFn(f) {
  return (+f.balance || 0) * (+f.rate || 0) / 100 / 26;
}

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
  return { ...e, subtype: e.subtype ?? 'fixed', type: e.type ?? 'standard', facilities: e.facilities ?? [] };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Expenses() {
  const { state, set }  = useApp();
  const [editing, setEditing]             = useState(null);
  const [form, setForm]                   = useState(EMPTY);
  const [expandedRows, setExpandedRows]   = useState(new Set());
  const [filterGroup, setFilterGroup]     = useState('All');

  const expenses = useMemo(() => state.expenses.map(normalizeLegacyExpense), [state.expenses]);
  const totalFn  = calcFortnightlyExpenses(expenses);

  // Per-category fortnightly totals
  const catTotals = useMemo(() => {
    const t = {};
    expenses.forEach(e => { t[e.category] = (t[e.category] || 0) + toFn(e); });
    return t;
  }, [expenses]);

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

  // Filtered expenses by group
  const filtered = useMemo(() => {
    if (filterGroup === 'All') return expenses;
    const g = EXPENSE_GROUPS.find(g => g.id === filterGroup);
    if (!g) return expenses;
    return expenses.filter(e => g.cats.includes(e.category));
  }, [expenses, filterGroup]);

  // Expenses organised by group for grouped rendering
  const groupedFiltered = useMemo(() => {
    if (filterGroup !== 'All') return null; // flat list when filtered
    return EXPENSE_GROUPS.map(g => ({
      ...g,
      items: expenses.filter(e => g.cats.includes(e.category)),
    })).filter(g => g.items.length > 0);
  }, [expenses, filterGroup]);

  // ── Row expand ─────────────────────────────────────────────────────────
  const toggleRow = (id, e) => {
    // Don't expand when clicking action buttons
    if (e.target.closest('button')) return;
    setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── Loan helpers ───────────────────────────────────────────────────────
  const facilitiesTotalFn = (facs) => (facs || []).reduce((s, f) => s + facToFn(f), 0);

  // ── Modal helpers ──────────────────────────────────────────────────────
  const openNew  = () => { setForm({ ...EMPTY, id: uid() }); setEditing('new'); };
  const openEdit = (e, ev) => { ev.stopPropagation(); setForm(normalizeLegacyExpense(e)); setEditing(e.id); };
  const close    = () => { setEditing(null); setForm(EMPTY); };

  const addFacility    = () => setForm(f => ({ ...f, facilities: [...f.facilities, { ...EMPTY_FACILITY, id: uid() }] }));
  const updateFacility = (id, field, val) => setForm(f => ({
    ...f, facilities: f.facilities.map(fac => fac.id === id ? { ...fac, [field]: val } : fac),
  }));
  const removeFacility = (id) => setForm(f => ({ ...f, facilities: f.facilities.filter(fac => fac.id !== id) }));

  const save = () => {
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
  const renderExpenseRow = (e) => {
    const isLoan    = e.type === 'loan';
    const isOpen    = expandedRows.has(e.id);
    const fn        = toFn(e);
    const catColor  = getCatColor(e.category);

    return (
      <div key={e.id} className={`expense-row ${isLoan ? 'loan-row' : ''} ${isOpen ? 'expanded' : ''}`}
        onClick={ev => toggleRow(e.id, ev)}>
        <div className="exp-cat-bar" style={{ background: catColor }} />
        <div className="exp-main">
          <div className="exp-top">
            <div className="exp-info">
              <span className="exp-name">
                {e.name}
                {isLoan && <span className="loan-badge">LOAN</span>}
              </span>
              <span className="exp-tags">
                <span className="tag">{e.category}</span>
                {isLoan && e.lender && <span className="tag teal">{e.lender}</span>}
                {isLoan && <span className="tag">{(e.facilities || []).length} split{(e.facilities || []).length !== 1 ? 's' : ''}</span>}
                {!isLoan && <span className="tag">{e.frequency}</span>}
                {!isLoan && e.paymentMethod && <span className="tag">{e.paymentMethod}</span>}
                {!isLoan && e.ddDay && <span className="tag teal">DD day {e.ddDay}</span>}
                {!isLoan && (e.subtype === 'variable' || e.type === 'variable') && <span className="tag amber">variable</span>}
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
                  {e.paymentMethod && (
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
                              {status === 'expired' ? ' · ⚠ expired' : status === 'soon' ? ' · ⚠ expiring soon' : ''}
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
      {expenses.length > 0 && (
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
      {expenses.length > 0 && (
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
                {g.items.map(renderExpenseRow)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="expense-list">
          {filtered.map(renderExpenseRow)}
        </div>
      )}

      {expenses.length === 0 && (
        <div className="empty-state">
          <div className="es-icon">💸</div>
          <div className="es-text">No expenses yet — add bills, loans and regular costs</div>
          <button className="btn-primary" onClick={openNew}>Add your first expense</button>
        </div>
      )}

      {/* ── MODAL ── */}
      {editing && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing === 'new' ? 'Add Expense' : 'Edit Expense'}</h3>
              <button className="btn-icon" onClick={close}><Icon name="close" /></button>
            </div>
            <div className="modal-body">

              {/* Expense type selector */}
              <div className="exp-type-sel">
                <button className={`ets-btn ${form.type !== 'loan' ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'standard' }))}>
                  Regular Expense
                </button>
                <button className={`ets-btn ${form.type === 'loan' ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: 'loan', category: f.category === 'Groceries' ? 'Mortgage' : f.category }))}>
                  Loan / Mortgage
                </button>
              </div>

              {/* ── STANDARD EXPENSE ── */}
              {form.type !== 'loan' && (
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Expense Name</label>
                    <input className="input" placeholder="e.g. Power — Contact Energy" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select className="input" value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {EXPENSE_GROUPS.map(g => (
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
                    <input className="input mono" type="number" step="0.01" placeholder="0.00" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
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
                      <input className="input" placeholder="e.g. ANZ Home Loan" value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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
              <button className="btn-primary" onClick={save}
                disabled={!form.name || (form.type !== 'loan' ? !form.amount : form.facilities.length === 0)}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
