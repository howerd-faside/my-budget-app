import { useMemo } from 'react';
import { useAllLoanFacilities } from '../../store/hooks';
import { calcObligationMetrics } from '../../utils/finance/loanFacilities';
import Icon from '../Icon';
import { SectionHeader, StatTile, Card } from '../ui';
import { fmtMoney } from '../../utils/finance/tax';

/**
 * PurchaseSummarySection — shows the purchase context for mortgage loans.
 *
 * Aggregates purchasePrice and deposit from all mortgage-category loan expenses
 * and shows equity position against the total outstanding balance (all facilities,
 * including zero-rate / interest-free family loans).
 */
export default function PurchaseSummarySection() {
  const { loanExpenses, facilities } = useAllLoanFacilities();

  const ctx = useMemo(() => {
    // Gather purchase context from mortgage-category loans
    const mortgages = loanExpenses.filter(e => e.category === 'Mortgage');
    const purchasePrice = mortgages.reduce((s, e) => s + (+e.purchasePrice || 0), 0);
    const deposit       = mortgages.reduce((s, e) => s + (+e.deposit || 0), 0);
    const settlementDate = mortgages.find(e => e.startDate)?.startDate || null;

    if (purchasePrice <= 0) return null;

    const { totalBalance } = calcObligationMetrics(facilities);
    const depositPct   = purchasePrice > 0 ? (deposit / purchasePrice * 100) : 0;
    const amountBorrowed = purchasePrice - deposit;
    const principalPaid  = amountBorrowed - totalBalance;
    const equity         = deposit + principalPaid;
    const equityPct      = purchasePrice > 0 ? (equity / purchasePrice * 100) : 0;
    const lvr            = purchasePrice > 0 ? (totalBalance / purchasePrice * 100) : 0;

    return {
      purchasePrice, deposit, depositPct,
      amountBorrowed, settlementDate,
      totalBalance, principalPaid, equity, equityPct, lvr,
    };
  }, [loanExpenses, facilities]);

  if (!ctx) return null;

  const fmtDate = (d) => {
    if (!d) return null;
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="home" size={15} /> Purchase Summary</>}
        subtitle={ctx.settlementDate ? `Settled ${fmtDate(ctx.settlementDate)}` : undefined}
      />

      <div className="fn-summary">
        <StatTile label="Purchase Price" value={fmtMoney(ctx.purchasePrice)} />
        <StatTile label="Deposit"        value={`${fmtMoney(ctx.deposit)} (${ctx.depositPct.toFixed(0)}%)`} />
        <StatTile label="Amount Borrowed" value={fmtMoney(ctx.amountBorrowed)} valueClassName="red" />
        <StatTile label="Principal Paid" value={fmtMoney(Math.max(0, ctx.principalPaid))} valueClassName="green" />
        <StatTile label="Equity"         value={`${fmtMoney(ctx.equity)} (${ctx.equityPct.toFixed(0)}%)`} valueClassName="teal" />
        <StatTile label="LVR"            value={`${ctx.lvr.toFixed(1)}%`} valueClassName={ctx.lvr > 80 ? 'red' : 'green'} />
      </div>
    </Card>
  );
}
