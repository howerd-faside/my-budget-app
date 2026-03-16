import { useState, useMemo } from 'react';
import { calcFortnightlyExpensesAt } from '../utils/finance/savings';
import { usePeople, useUndoDelete } from '../store/hooks';
import { fmtMoneyRound } from '../utils/finance/tax';
import { toFortnightly } from '../utils/finance/frequency';
import { createExpense, createFacility } from '../models/Expense';
import { EXPENSE_GROUPS, CATEGORIES } from '../utils/categories';
import Icon from '../components/Icon';
import { validate, expenseSchema, loanExpenseSchema } from '../utils/validation';
import { ConfirmDialog } from '../components/ui';
import { SectionHeader, StatTile, EmptyState, Card } from '../components/ui';
import { today } from '../utils/finance/dates';
import ExpenseRow from './expenses/ExpenseRow';
import ExpenseModal from './expenses/ExpenseModal';

const TODAY_STR      = today();
const EMPTY          = createExpense();
const EMPTY_FACILITY = createFacility();

const toFn = (e) => toFortnightly(e.amount, e.frequency);

function normalizeLegacyExpense(e) {
  if (e.type === 'fixed' || e.type === 'variable') {
    return { ...e, subtype: e.type, type: 'standard' };
  }
  return { ...e, subtype: e.subtype ?? 'fixed', type: e.type ?? 'standard', facilities: e.facilities ?? [], forPerson: e.forPerson ?? '' };
}

export default function Expenses() {
  const { expenses: storeExpenses, setPeople } = usePeople();
  const undoDelete = useUndoDelete();
  const [editing, setEditing]             = useState(null);
  const [form, setForm]                   = useState(EMPTY);
  const [errors, setErrors]               = useState({});
  const [expandedRows, setExpandedRows]   = useState(new Set());
  const [filterGroup, setFilterGroup]     = useState('All');
  const [archiveOpen, setArchiveOpen]     = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const expenses = useMemo(() => storeExpenses.map(normalizeLegacyExpense), [storeExpenses]);

  const activeExpenses = useMemo(
    () => expenses.filter(e => !e.endDate || e.endDate >= TODAY_STR),
    [expenses]
  );
  const archivedExpenses = useMemo(
    () => [...expenses.filter(e => e.endDate && e.endDate < TODAY_STR)]
           .sort((a, b) => b.endDate.localeCompare(a.endDate)),
    [expenses]
  );

  const totalFn = calcFortnightlyExpensesAt(activeExpenses, TODAY_STR);

  const catTotals = useMemo(() => {
    const t = {};
    activeExpenses.forEach(e => {
      if (e.startDate && e.startDate > TODAY_STR) return;
      t[e.category] = (t[e.category] || 0) + toFn(e);
    });
    return t;
  }, [activeExpenses]);

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

  const filtered = useMemo(() => {
    if (filterGroup === 'All') return activeExpenses;
    const g = EXPENSE_GROUPS.find(g => g.id === filterGroup);
    if (!g) return activeExpenses;
    return activeExpenses.filter(e => g.cats.includes(e.category));
  }, [activeExpenses, filterGroup]);

  const groupedFiltered = useMemo(() => {
    if (filterGroup !== 'All') return null;
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
  const facilitiesTotalFn = (facs) => (facs || []).reduce((s, f) => s + toFortnightly(f.amount, f.frequency || 'fortnightly'), 0);

  // ── Modal helpers ──────────────────────────────────────────────────────
  const openNew  = () => { setForm({ ...EMPTY, id: crypto.randomUUID() }); setEditing('new'); setErrors({}); };
  const openEdit = (e, ev) => { ev.stopPropagation(); setForm(normalizeLegacyExpense(e)); setEditing(e.id); setErrors({}); };
  const close    = () => { setEditing(null); setForm(EMPTY); setErrors({}); };

  const addFacility    = () => setForm(f => ({ ...f, facilities: [...f.facilities, { ...EMPTY_FACILITY, id: crypto.randomUUID() }] }));
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
      setPeople('expenses', [...storeExpenses, expense]);
    } else {
      const existing = storeExpenses.find(e => e.id === form.id);
      if (existing && +existing.amount !== +expense.amount) {
        expense.history = [...(existing.history || []),
          { date: new Date().toISOString().slice(0, 10), oldAmount: existing.amount, newAmount: expense.amount }];
      }
      setPeople('expenses', storeExpenses.map(e => e.id === form.id ? expense : e));
    }
    close();
  };

  const remove = (id, e) => {
    e.stopPropagation();
    setConfirmTarget(id);
  };

  const executeRemove = () => {
    if (confirmTarget) {
      const name = storeExpenses.find(e => e.id === confirmTarget)?.name || 'Expense';
      undoDelete({
        label: `${name} removed`,
        domain: 'people',
        snapshot: { expenses: storeExpenses },
        applyFn: () => setPeople('expenses', storeExpenses.filter(e => e.id !== confirmTarget)),
      });
    }
    setConfirmTarget(null);
  };

  return (
    <div className="page-content">
      {activeExpenses.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="tag" size={15} /> Spending Breakdown</>}
            actions={
              <>
                <span className="text3" style={{ fontSize: 11 }}>{fmtMoneyRound(totalFn * 26)}/yr</span>
                <button className="btn-ghost small" onClick={openNew}>+ Add Expense</button>
              </>
            }
          />

          <div className="fn-summary">
            <StatTile label="Fortnightly" value={fmtMoneyRound(totalFn)} valueClassName="red" />
            <StatTile label="Monthly"     value={fmtMoneyRound(totalFn * 26 / 12)} />
            <StatTile label="Annual"      value={fmtMoneyRound(totalFn * 26)} />
          </div>

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
        </Card>
      )}

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
                {g.items.map(e => (
                  <ExpenseRow key={e.id} expense={e} expanded={expandedRows.has(e.id)}
                    onToggle={ev => toggleRow(e.id, ev)}
                    onEdit={ev => openEdit(e, ev)}
                    onRemove={ev => remove(e.id, ev)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="expense-list">
          {filtered.map(e => (
            <ExpenseRow key={e.id} expense={e} expanded={expandedRows.has(e.id)}
              onToggle={ev => toggleRow(e.id, ev)}
              onEdit={ev => openEdit(e, ev)}
              onRemove={ev => remove(e.id, ev)} />
          ))}
        </div>
      )}

      {expenses.length === 0 && (
        <EmptyState
          icon="💸"
          title="No expenses yet — add bills, loans and regular costs"
          action={<button className="btn-primary" onClick={openNew}>Add your first expense</button>}
        />
      )}

      {archivedExpenses.length > 0 && (
        <Card variant="section" style={{ marginTop: 16 }}>
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
              {archivedExpenses.map(e => (
                <ExpenseRow key={e.id} expense={e} expanded={expandedRows.has(e.id)}
                  onToggle={ev => toggleRow(e.id, ev)}
                  onEdit={ev => openEdit(e, ev)}
                  onRemove={ev => remove(e.id, ev)}
                  archived />
              ))}
            </div>
          )}
        </Card>
      )}

      {expenses.length > 0 && activeExpenses.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="btn-ghost small" onClick={openNew}>+ Add Expense</button>
        </div>
      )}

      <ExpenseModal
        editing={editing} form={form} setForm={setForm} errors={errors}
        onClose={close} onSave={save}
        addFacility={addFacility} updateFacility={updateFacility} removeFacility={removeFacility}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        title="Remove expense"
        message="Remove this expense?"
        confirmLabel="Remove"
        onConfirm={executeRemove}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
