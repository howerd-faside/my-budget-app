import { useState, useMemo } from 'react';
import { calcFortnightlyIncome, calcFortnightlyExpenses, calcFortnightlyExpensesAt, calcFortnightlyAssetIncome, calcFortnightlyIncomeAt, totalBalance, buildSavingsTrajectory } from '../utils/finance/savings';
import { getFortnight } from '../utils/finance/dates';
import { useFinance } from '../store/hooks';
import { usePeople }  from '../store/hooks';
import { fmtMoney, fmtMoneyRound } from '../utils/finance/tax';
import { ADHOC_EXPENSE_CATS } from '../utils/categories';
import Icon from '../components/Icon';
import { SectionHeader, StatTile, Card, Modal } from '../components/ui';
import { today } from '../utils/finance/dates';

import BalanceTrendChart from './tracking/BalanceTrendChart';
import FortnightList from './tracking/FortnightList';

const EXPENSE_CATS  = ADHOC_EXPENSE_CATS;
const INCOME_CATS   = ['Bonus', 'Commission', 'Tax Refund', 'Side Income', 'Gift Received', 'Other Income'];
const YEAR_WINDOW   = 7;


export default function FinancialTracking() {
  const { accounts, fortnightlyData, assetIncomes, updateFortnight: updFn, updateAccount } = useFinance();
  const { people, expenses } = usePeople();
  const thisYear = new Date().getFullYear();
  const [year,         setYear]         = useState(thisYear);
  const [windowStart,  setWindowStart]  = useState(thisYear);
  const [yearAnimKey,  setYearAnimKey]  = useState(0);
  const [yearSlideDir, setYearSlideDir] = useState(0);
  const [txModal, setTxModal] = useState(null);
  const [txType, setTxType]   = useState('expense');
  const [txForm, setTxForm]   = useState({ description: '', amount: '', category: 'Other', note: '' });

  const fnIncome      = calcFortnightlyIncome(people);
  const fnAssetIncome = calcFortnightlyAssetIncome(assetIncomes || []);
  const fnExpenses    = calcFortnightlyExpenses(expenses);

  const now           = new Date();
  const fnIncomeNow   = calcFortnightlyIncomeAt(people, now);
  const fnNet         = fnIncomeNow + fnAssetIncome - fnExpenses;
  const fnNetBase     = fnIncome + fnAssetIncome - fnExpenses;
  const incomeEventActiveNow = Math.abs(fnIncomeNow - fnIncome) > 0.5;

  const startBal   = totalBalance(accounts);
  const trajectory = useMemo(() => buildSavingsTrajectory({ people, expenses, fortnightlyData, accounts, assetIncomes }), [people, expenses, fortnightlyData, accounts, assetIncomes]);

  const yd = fortnightlyData[year] || { fortnights: {} };

  const fortnights = useMemo(() => {
    const now        = new Date();
    const thisYear   = now.getFullYear();
    const isPast     = year < thisYear;

    const rows = Array.from({ length: 26 }, (_, i) => {
      const { start, end } = getFortnight(year, i);
      const ftData         = (yd.fortnights || {})[i] || { adhocTransactions: [] };
      const adhoc          = (ftData.adhocTransactions || []).reduce((s, t) => s + (t.amount || 0), 0);
      const midDate        = new Date((start.getTime() + end.getTime()) / 2);
      const fnIncomeAt     = calcFortnightlyIncomeAt(people, midDate);
      const fnExpensesAt   = calcFortnightlyExpensesAt(expenses, midDate);
      const actual         = fnIncomeAt + fnAssetIncome - fnExpensesAt + adhoc;
      return { i, start, end, adhoc, actual, fnIncomeAt, fnExpensesAt, ftData, balance: 0 };
    });

    const curIdx = year === thisYear
      ? rows.findIndex(f => now >= f.start && now <= f.end)
      : -1;

    if (curIdx >= 0) {
      rows[curIdx].balance = startBal;
      for (let i = curIdx + 1; i < 26; i++)
        rows[i].balance = rows[i - 1].balance + rows[i].actual;
      for (let i = curIdx - 1; i >= 0; i--)
        rows[i].balance = rows[i + 1].balance - rows[i + 1].actual;
    } else if (isPast) {
      rows[0].balance = rows[0].actual;
      for (let i = 1; i < 26; i++)
        rows[i].balance = rows[i - 1].balance + rows[i].actual;
    } else {
      const firstStart = rows[0].start.toISOString().slice(0, 10);
      let openBal = startBal;
      for (const p of trajectory) {
        if (p.date < firstStart) openBal = Math.round(p.balance);
        else break;
      }
      rows[0].balance = openBal + rows[0].actual;
      for (let i = 1; i < 26; i++)
        rows[i].balance = rows[i - 1].balance + rows[i].actual;
    }

    return rows;
  }, [year, yd, expenses, fnAssetIncome, startBal, people, trajectory]);

  const todayDate    = new Date();
  const isPastYear   = year < thisYear;
  const currentFnIdx = fortnights.findIndex(f => todayDate >= f.start && todayDate <= f.end);
  const yearAdhoc    = fortnights.reduce((s, f) => s + f.adhoc, 0);
  const yearTotal    = fortnights.reduce((s, f) => s + f.actual, 0);
  const closingBal   = fortnights[25]?.balance ?? 0;
  const balDelta     = isPastYear ? yearAdhoc : closingBal - startBal;
  const windowYears  = Array.from({ length: YEAR_WINDOW }, (_, i) => windowStart + i);
  const selectedIdx  = windowYears.indexOf(year);
  const yearAnimClass = yearSlideDir > 0 ? 'anim-slide-right' : yearSlideDir < 0 ? 'anim-slide-left' : '';

  const changeYear = (newYear) => {
    if (newYear === year) return;
    setYearSlideDir(newYear > year ? 1 : -1);
    setYearAnimKey(k => k + 1);
    setYear(newYear);
  };

  const shiftWindow = (dir) => setWindowStart(s => s + dir);

  const fnIncomeForYear   = fortnights[0]?.fnIncomeAt   ?? fnIncomeNow;
  const fnExpensesForYear = fortnights[0]?.fnExpensesAt ?? fnExpenses;
  const fnNetForYear      = fnIncomeForYear + fnAssetIncome - fnExpensesForYear;
  const incomeEventInYear = people.some(p =>
    (p.incomeEvents || []).some(e =>
      e.startDate &&
      e.startDate.slice(0, 4) <= String(year) &&
      (!e.endDate || e.endDate.slice(0, 4) >= String(year))
    )
  );

  const sparkData = fortnights.map(f => {
    const isBefore = f.end < todayDate;
    const raw = Math.round(f.balance);
    const bal = isBefore ? Math.max(0, raw) : raw;
    const inEvent = Math.abs(f.fnIncomeAt - fnIncome) > 0.5;
    return { n: f.i + 1, b: bal, adhoc: f.adhoc, eventBalance: inEvent ? bal : null };
  });

  const incomeMarkers = useMemo(() => {
    const areas = [];
    const lines = [];
    const yearStartStr = `${year}-01-01`;
    const yearEndStr   = `${year}-12-31`;

    for (const person of people) {
      for (const e of (person.incomeEvents || [])) {
        if (!e.startDate) continue;
        if (e.startDate > yearEndStr) continue;
        if (e.endDate && e.endDate < yearStartStr) continue;

        const startD = new Date(e.startDate);
        const x1fn = fortnights.findIndex(f => startD <= f.end);
        const x1 = x1fn >= 0 ? x1fn + 1 : 1;
        let x2 = 26;
        if (e.endDate) {
          const endD = new Date(e.endDate);
          const x2fn = fortnights.findLastIndex(f => endD > f.start);
          x2 = x2fn >= 0 ? x2fn + 1 : 0;
        }
        if (x2 >= x1) areas.push({ x1, x2, label: e.label || 'Income event', color: '#FF9F0A' });
      }
      for (const r of (person.employmentHistory || [])) {
        if (!r.startDate) continue;
        const d = new Date(r.startDate);
        const fnIdx = fortnights.findIndex(f => d >= f.start && d <= f.end);
        if (fnIdx >= 0) lines.push({ n: fnIdx + 1, label: r.employer || 'New role', color: '#0071E3' });
      }
    }
    const seen = new Set();
    const dedupedLines = lines.filter(m => { const k = `${m.n}-${m.label}`; if (seen.has(k)) return false; seen.add(k); return true; });
    return { areas, lines: dedupedLines };
  }, [people, fortnights]);

  const openTxModal = (fnIdx) => {
    setTxForm({ description: '', amount: '', category: 'Other', note: '' });
    setTxType('expense');
    setTxModal(fnIdx);
  };

  const addTransaction = () => {
    if (!txForm.description || !txForm.amount) return;
    const existing = (yd.fortnights || {})[txModal] || { adhocTransactions: [] };
    const isIncome = txType === 'income';
    const amount = isIncome ? +Math.abs(+txForm.amount) : -Math.abs(+txForm.amount);
    const tx = {
      id: crypto.randomUUID(),
      date: today(),
      description: txForm.description,
      amount,
      category: txForm.category,
      note: txForm.note,
      type: txType,
    };
    updFn(year, txModal, { adhocTransactions: [...(existing.adhocTransactions || []), tx] });

    // Past/current ad-hoc: money already spent (or received), adjust account balance.
    // Future fortnights are projections only — no account change.
    const isFuture = year > thisYear || (year === thisYear && currentFnIdx >= 0 && txModal > currentFnIdx);
    if (!isFuture) {
      const target = accounts.find(a => a.id === 'main') || accounts[0];
      if (target) updateAccount(target.id, (target.balance || 0) + amount);
    }

    setTxModal(null);
  };

  const removeTx = (fnIdx, txId) => {
    const existing = (yd.fortnights || {})[fnIdx] || { adhocTransactions: [] };
    const tx = (existing.adhocTransactions || []).find(t => t.id === txId);
    updFn(year, fnIdx, { adhocTransactions: (existing.adhocTransactions || []).filter(t => t.id !== txId) });

    // Reverse: past/current removal restores the amount to the account
    const isFuture = year > thisYear || (year === thisYear && currentFnIdx >= 0 && fnIdx > currentFnIdx);
    if (!isFuture && tx) {
      const target = accounts.find(a => a.id === 'main') || accounts[0];
      if (target) updateAccount(target.id, (target.balance || 0) - tx.amount);
    }
  };

  const cats = txType === 'income' ? INCOME_CATS : EXPENSE_CATS;

  return (
    <div className="page-content">
      <div className="year-bar">
        <button className="year-nav-btn" onClick={() => shiftWindow(-1)} aria-label="Previous year">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8l5 5"/>
          </svg>
        </button>
        <div className="year-pills">
          {selectedIdx >= 0 && (
            <div
              className="year-pill-indicator"
              style={{ transform: `translateX(${selectedIdx * 100}%)` }}
            />
          )}
          {windowYears.map(y => (
            <button
              key={y}
              className={`year-pill ${year === y ? 'active' : ''}`}
              onClick={() => changeYear(y)}
            >{y}</button>
          ))}
        </div>
        <button className="year-nav-btn" onClick={() => shiftWindow(1)} aria-label="Next year">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3l5 5-5 5"/>
          </svg>
        </button>
      </div>

      <div key={yearAnimKey} className={`year-content ${yearAnimClass}`}>
      {/* Overview section */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="wallet" size={15} /> Overview — {year}</>}
          actions={<span className="text3" style={{ fontSize: 11 }}>26 fortnights</span>}
        />

      <div className="fn-summary">
        <StatTile label="Current Balance" value={fmtMoneyRound(startBal)} valueClassName="teal" />
        <StatTile
          label="Net /fn"
          value={fmtMoneyRound(fnNetForYear)}
          valueClassName={fnNetForYear >= 0 ? 'green' : 'red'}
          meta={incomeEventInYear ? `base ${fmtMoneyRound(fnNetBase)}` : undefined}
        />
        <StatTile
          label={`Ad-hoc ${year}`}
          value={`${yearAdhoc < 0 ? '−' : '+'}${fmtMoneyRound(Math.abs(yearAdhoc))}`}
          valueClassName={yearAdhoc >= 0 ? 'green' : 'red'}
        />
        <StatTile
          label={`Net Saved ${year}`}
          value={fmtMoneyRound(yearTotal)}
          valueClassName={yearTotal >= 0 ? 'green' : 'red'}
        />
        {!isPastYear && (
          <StatTile
            label={`Projected Dec ${year}`}
            value={fmtMoneyRound(closingBal)}
            valueClassName="teal"
          />
        )}
      </div>

      {fnIncome === 0 && (
        <div className="warning-banner">
          No income set — add income profiles in the <strong>Income</strong> tab first.
        </div>
      )}
      {incomeEventInYear && (
        <div className="info-banner" style={{ marginBottom: 16 }}>
          Income events active in {year} — some fortnights show adjusted net income.
        </div>
      )}

      {/* Balance Trend chart */}
      <BalanceTrendChart
        sparkData={sparkData}
        currentFnIdx={currentFnIdx}
        incomeMarkers={incomeMarkers}
        fortnights={fortnights}
        fnIncome={fnIncome}
        isPastYear={isPastYear}
        balDelta={balDelta}
      />

      {/* Income events list */}
      {(() => {
        const yearStart = `${year}-01-01`;
        const yearEnd   = `${year}-12-31`;
        const events = people.flatMap(p =>
          (p.incomeEvents || [])
            .filter(e => e.startDate && e.startDate <= yearEnd && (!e.endDate || e.endDate >= yearStart))
            .map(e => ({ ...e, personName: p.name }))
        );
        if (!events.length) return null;
        return (
          <div className="traj-events">
            {events.map(e => {
              const inYearNow = new Date(e.startDate) <= now && (!e.endDate || new Date(e.endDate) > now);
              return (
                <div key={e.id} className={`traj-event-row ${inYearNow ? 'active' : ''}`}>
                  <span className="traj-event-dot" style={{ background: inYearNow ? '#FF9F0A' : 'var(--text3)' }} />
                  <span className="traj-event-label">{e.label || 'Income event'}</span>
                  <span className="traj-event-person text3">{e.personName}</span>
                  <span className="traj-event-dates text3 mono">
                    {e.startDate?.slice(0, 7)}{e.endDate ? ` → ${e.endDate.slice(0, 7)}` : ' → ongoing'}
                  </span>
                  {inYearNow && <span className="fn-badge event-badge" style={{ marginLeft: 'auto' }}>Active now</span>}
                </div>
              );
            })}
          </div>
        );
      })()}

      </Card>

      {/* Fortnight list */}
      <FortnightList
        year={year}
        fortnights={fortnights}
        currentFnIdx={currentFnIdx}
        fnIncome={fnIncome}
        onOpenTxModal={openTxModal}
        onRemoveTx={removeTx}
      />
      </div>

      {/* Add transaction modal */}
      <Modal
        isOpen={txModal !== null}
        onClose={() => setTxModal(null)}
        title="Log Ad-hoc Transaction"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setTxModal(null)}>Cancel</button>
            <button
              className={`btn-primary ${txType === 'income' ? 'btn-green' : ''}`}
              onClick={addTransaction}
              disabled={!txForm.description || !txForm.amount}
            >
              {txType === 'income' ? 'Add Income' : 'Add Expense'}
            </button>
          </>
        }
      >
        <div className="tx-type-toggle">
          <button
            className={`ttog-btn ${txType === 'expense' ? 'active red' : ''}`}
            onClick={() => { setTxType('expense'); setTxForm(t => ({ ...t, category: 'Other' })); }}
          >
            Expense
          </button>
          <button
            className={`ttog-btn ${txType === 'income' ? 'active green' : ''}`}
            onClick={() => { setTxType('income'); setTxForm(t => ({ ...t, category: 'Bonus' })); }}
          >
            Income
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group full">
            <label>Description</label>
            <input className="input" placeholder={txType === 'income' ? 'e.g. Year-end bonus' : 'e.g. Petrol'} autoFocus value={txForm.description}
              onChange={e => setTxForm(t => ({ ...t, description: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addTransaction()} />
          </div>
          <div className="form-group">
            <label>Amount ($)</label>
            <input className="input mono" type="number" step="0.01" placeholder="0.00" value={txForm.amount}
              onChange={e => setTxForm(t => ({ ...t, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select className="input" value={txForm.category}
              onChange={e => setTxForm(t => ({ ...t, category: e.target.value }))}>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group full">
            <label>Note (optional)</label>
            <input className="input" placeholder="Optional note" value={txForm.note}
              onChange={e => setTxForm(t => ({ ...t, note: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
