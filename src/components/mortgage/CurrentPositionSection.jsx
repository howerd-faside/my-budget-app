import { useMemo } from 'react';
import { useMortgageSummary, useAllLoanFacilities } from '../../store/hooks';
import { calcObligationMetrics } from '../../utils/finance/loanFacilities';
import Icon from '../Icon';
import { SectionHeader, StatTile, Card, EmptyState } from '../ui';
import { fmtMoney } from '../../utils/finance/tax';

export default function CurrentPositionSection() {
  // Rate > 0 metrics for interest/crossover calculations
  const {
    totalInterest, intPct, crossoverYear,
  } = useMortgageSummary();

  // ALL facilities (including zero-rate) for the full debt picture
  const { loanExpenses, facilities, hasLoans } = useAllLoanFacilities();

  const allMetrics = useMemo(
    () => calcObligationMetrics(facilities),
    [facilities],
  );

  if (!hasLoans) {
    return (
      <Card variant="section">
        <SectionHeader title={<><Icon name="mortgage" size={15} /> Current Position</>} />
        <EmptyState
          title={loanExpenses.length === 0
            ? 'No loans set up yet — add a loan expense with facilities in the Expenses tab.'
            : 'Loan found but no qualifying facilities (balance and repayment amount required).'}
        />
      </Card>
    );
  }

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="mortgage" size={15} /> Current Position</>}
        subtitle={allMetrics.payoffYear ? `Estimated payoff ${allMetrics.payoffYear}` : undefined}
      />

      <div className="fn-summary">
        <StatTile label="Total Outstanding"  value={fmtMoney(allMetrics.totalBalance)} valueClassName="red" />
        <StatTile label="Repayment /fn"       value={fmtMoney(allMetrics.repaymentFn)}  valueClassName="red" />
        {totalInterest > 0 && (
          <StatTile label="Total Interest Left" value={fmtMoney(totalInterest)} valueClassName="amber" />
        )}
        {intPct > 0 && (
          <StatTile label="Interest % of Total" value={`${intPct}%`} valueClassName="amber" />
        )}
        {crossoverYear !== null && (
          <StatTile label="Principal > Interest" value={crossoverYear} valueClassName="green" />
        )}
        {allMetrics.payoffYear && (
          <StatTile label="Payoff Year" value={allMetrics.payoffYear} valueClassName="teal" />
        )}
      </div>
    </Card>
  );
}
