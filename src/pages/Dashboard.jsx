import { useState, useMemo } from 'react';
import {
  totalBalance, calcFortnightlyIncome, calcFortnightlyIncomeAt, calcFortnightlyExpensesAt, calcFortnightlyAssetIncome, buildSavingsTrajectory, getPersonIncomeAt,
} from '../utils/finance/savings';
import { useFinance } from '../store/hooks';
import { usePeople }  from '../store/hooks';
import { fmtMoneyRound, calcNetPay } from '../utils/finance/tax';
import { toFortnightly } from '../utils/finance/frequency';
import { EXPENSE_GROUPS } from '../utils/categories';
import Icon from '../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card } from '../components/ui';
import { today } from '../utils/finance/dates';

import AccountCard from './dashboard/AccountCard';
import TransferModal from './dashboard/TransferModal';
import IncomeCard from './dashboard/IncomeCard';
import TrajectorySection from './dashboard/TrajectorySection';
import ExpensesSection from './dashboard/ExpensesSection';
import LoanSection from './dashboard/LoanSection';


// ── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { accounts: rawAccounts, transfers, fortnightlyData, goals, assetIncomes, setFinance, updateAccount, addTransfer, removeTransfer } = useFinance();
  const { people, expenses } = usePeople();
  const [showTransfer, setShowTransfer] = useState(false);

  const accounts      = rawAccounts || [];
  const netWorth      = totalBalance(accounts);
  const fnIncome      = calcFortnightlyIncome(people);       // base (no events)
  const fnAssetIncome = calcFortnightlyAssetIncome(assetIncomes || []);
  // Event-aware income for today
  const now            = new Date();
  const fnExpenses    = calcFortnightlyExpensesAt(expenses, now);
  const fnIncomeNow    = calcFortnightlyIncomeAt(people, now);
  const fnNet          = fnIncomeNow + fnAssetIncome - fnExpenses;
  const fnTotal        = fnIncomeNow + fnAssetIncome;
  const savingsRate    = fnTotal > 0 ? Math.round(fnNet / fnTotal * 100) : 0;
  const incomeEventActiveNow = Math.abs(fnIncomeNow - fnIncome) > 0.5;

  // ── Income ────────────────────────────────────────────────────────────────
  const incomeRows = useMemo(() => {
    const d = new Date();
    return people.map(p => {
      const { grossAnnual: effectiveGross, eventLabel, employer } = getPersonIncomeAt(p, d);
      const effectivePay = calcNetPay({ ...p, grossAnnual: effectiveGross });
      const basePay      = calcNetPay(p);
      return { ...p, _effectivePay: effectivePay, _basePay: basePay, _eventLabel: eventLabel, _employer: employer };
    });
  }, [people]);
  const totalGrossAnnual = incomeRows.reduce((s, p) => s + (p._effectivePay?.grossAnnual || p.grossAnnual || 0), 0);
  const totalNetAnnual   = fnIncomeNow * 26;
  const avgTaxRate       = totalGrossAnnual > 0
    ? incomeRows.reduce((s, p) => s + (p._effectivePay?.taxAnnual || 0), 0) / totalGrossAnnual * 100
    : 0;

  // ── Expenses ──────────────────────────────────────────────────────────────
  const groupTotals = useMemo(() => {
    const catTotals = {};
    expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + toFortnightly(e.amount, e.frequency); });
    const t = {};
    EXPENSE_GROUPS.forEach(g => { t[g.id] = g.cats.reduce((s, c) => s + (catTotals[c] || 0), 0); });
    return t;
  }, [expenses]);

  // ── Goals & Trajectory ────────────────────────────────────────────────────
  const trajectory = useMemo(() => buildSavingsTrajectory({ people, expenses, fortnightlyData, accounts, assetIncomes }), [people, expenses, fortnightlyData, accounts, assetIncomes]);

  const todayStr = today();
  const todayIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < trajectory.length; i++) {
      if (trajectory[i].date <= todayStr) idx = i;
      else break;
    }
    return idx;
  }, [trajectory, todayStr]);
  const todayLabel = trajectory[todayIdx]?.date.slice(0, 7);

  const goalsWithDates = useMemo(() => {
    return (goals || []).map(g => {
      const hit     = trajectory.find(p => p.balance >= (g.amount || 0));
      const hitDate = hit ? hit.date.slice(0, 7) : null;
      let monthsRemaining = null;
      if (hitDate) {
        const [hy, hm] = hitDate.split('-').map(Number);
        const now = new Date();
        monthsRemaining = Math.max(0, (hy - now.getFullYear()) * 12 + (hm - (now.getMonth() + 1)));
      }
      return { ...g, _hitDate: hitDate, _hitBalance: hit?.balance, _monthsRemaining: monthsRemaining };
    });
  }, [goals, trajectory]);

  const currentBal = trajectory[todayIdx]?.balance ?? netWorth;

  // ── Loans ─────────────────────────────────────────────────────────────────
  const loanExpenses = useMemo(() => (expenses || []).filter(e => e.type === 'loan'), [expenses]);

  const allFacilities = useMemo(() =>
    loanExpenses.flatMap(loan =>
      (loan.facilities || [])
        .filter(f => (+f.balance || 0) > 0 && (+f.rate || 0) > 0 && (+f.amount || 0) > 0)
        .map(f => ({ ...f, loanName: loan.name }))
    ), [loanExpenses]);

  // ── Transfers ─────────────────────────────────────────────────────────────
  const recentTransfers = useMemo(() =>
    [...(transfers || [])].reverse().slice(0, 6), [transfers]);

  const accountName = (id) => accounts.find(a => a.id === id)?.name || id;

  return (
    <div className="page-content">
      {/* ── ACCOUNTS ────────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="bank" size={15} /> Accounts</>}
          actions={accounts.length > 1 && (
            <button className="btn-ghost small" onClick={() => setShowTransfer(true)}>
              <Icon name="swap" size={12} /> Transfer
            </button>
          )}
        />

        <div className="account-cards">
          {accounts.map(a => (
            <AccountCard key={a.id} account={a} total={netWorth} updateAccount={updateAccount} />
          ))}
        </div>

        {recentTransfers.length > 0 && (
          <>
            <div className="section-subheader">
              <span>Recent Transfers</span>
            </div>
            <div className="transfer-history-card">
              {recentTransfers.map(tx => (
                <div key={tx.id} className="th-row">
                  <span className="th-date">{tx.date}</span>
                  <span className="th-accounts">
                    {accountName(tx.fromId)} → {accountName(tx.toId)}
                    {tx.note && <span className="th-note"> · {tx.note}</span>}
                  </span>
                  <span className="th-amount">{fmtMoneyRound(tx.amount)}</span>
                  <button className="btn-icon small" onClick={() => removeTransfer(tx.id)} title="Undo transfer" aria-label="Undo transfer">
                    <Icon name="close" size={10} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ── INCOME ──────────────────────────────────────────────────────── */}
      {people.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="arrow-up" size={15} /> Income</>}
            actions={<span className="text3" style={{ fontSize: 11 }}>{people.length} earner{people.length !== 1 ? 's' : ''}</span>}
          />

          <div className="fn-summary">
            <StatTile
              label="Employment /fn"
              value={fmtMoneyRound(fnIncomeNow)}
              valueClassName={incomeEventActiveNow ? 'amber' : 'green'}
              meta={incomeEventActiveNow ? `base ${fmtMoneyRound(fnIncome)}` : undefined}
            />
            {fnAssetIncome > 0 && (
              <StatTile label="Asset Income /fn" value={fmtMoneyRound(fnAssetIncome)} valueClassName="teal" />
            )}
            <StatTile label="Annual Gross" value={fmtMoneyRound(totalGrossAnnual)} />
            <StatTile label="Annual Net" value={fmtMoneyRound(totalNetAnnual)} valueClassName={incomeEventActiveNow ? 'amber' : 'green'} />
            <StatTile label="Avg Tax Rate" value={`${avgTaxRate.toFixed(1)}%`} valueClassName="amber" />
          </div>

          <div className="income-grid">
            {incomeRows.map(p => <IncomeCard key={p.id} person={p} />)}
          </div>
        </Card>
      )}

      {/* ── SAVINGS TRAJECTORY ──────────────────────────────────────── */}
      <TrajectorySection
        trajectory={trajectory}
        todayIdx={todayIdx}
        todayLabel={todayLabel}
        people={people}
        goals={goals}
        goalsWithDates={goalsWithDates}
        currentBal={currentBal}
        fnIncome={fnIncome}
        savingsRate={savingsRate}
        setFinance={setFinance}
      />

      {/* ── EXPENSES ────────────────────────────────────────────────────── */}
      {expenses.length > 0 && (
        <ExpensesSection fnExpenses={fnExpenses} groupTotals={groupTotals} />
      )}

      {/* ── HOME LOANS ──────────────────────────────────────────────────── */}
      {loanExpenses.length > 0 && (
        <LoanSection loanExpenses={loanExpenses} allFacilities={allFacilities} />
      )}

      {/* Empty state */}
      {people.length === 0 && expenses.length === 0 && (
        <EmptyState
          icon="◈"
          title="Welcome! Start by adding your income profile and expenses to see your financial picture."
        />
      )}

      {showTransfer && (
        <TransferModal
          accounts={accounts}
          onClose={() => setShowTransfer(false)}
          onTransfer={(form) => addTransfer(form)}
        />
      )}
    </div>
  );
}
