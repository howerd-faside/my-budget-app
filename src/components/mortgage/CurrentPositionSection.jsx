import { useMortgageSummary, useMortgageFacilities } from '../../store/hooks';
import Icon from '../Icon';
import { SectionHeader, StatTile, Card, EmptyState } from '../ui';
import { fmtMoney } from '../../utils/finance/tax';

export default function CurrentPositionSection() {
  const {
    totalBalance, repaymentFn, totalInterest,
    intPct, payoffYear, crossoverYear, hasLoans,
  } = useMortgageSummary();

  const { loanExpenses } = useMortgageFacilities();

  if (!hasLoans) {
    return (
      <Card variant="section">
        <SectionHeader title={<><Icon name="mortgage" size={15} /> Current Position</>} />
        <EmptyState
          title={loanExpenses.length === 0
            ? 'No loans set up yet — add a loan expense with facilities in the Expenses tab.'
            : 'Loan found but no qualifying facilities (balance, rate, and repayment amount all required).'}
        />
      </Card>
    );
  }

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="mortgage" size={15} /> Current Position</>}
        subtitle={payoffYear ? `Estimated payoff ${payoffYear}` : undefined}
      />

      <div className="fn-summary">
        <StatTile label="Total Outstanding"  value={fmtMoney(totalBalance)} valueClassName="red" />
        <StatTile label="Repayment /fn"       value={fmtMoney(repaymentFn)}  valueClassName="red" />
        <StatTile label="Total Interest Left" value={fmtMoney(totalInterest)} valueClassName="amber" />
        {intPct > 0 && (
          <StatTile label="Interest % of Total" value={`${intPct}%`} valueClassName="amber" />
        )}
        {crossoverYear !== null && (
          <StatTile label="Principal > Interest" value={crossoverYear} valueClassName="green" />
        )}
        {payoffYear && (
          <StatTile label="Payoff Year" value={payoffYear} valueClassName="teal" />
        )}
      </div>
    </Card>
  );
}
