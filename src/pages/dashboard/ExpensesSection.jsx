import { fmtMoneyRound } from '../../utils/finance/tax';
import { EXPENSE_GROUPS } from '../../utils/categories';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, Card } from '../../components/ui';

export default function ExpensesSection({ fnExpenses, groupTotals }) {
  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="tag" size={15} /> Expenses</>}
        actions={<span className="text3" style={{ fontSize: 11 }}>{fmtMoneyRound(fnExpenses * 26)}/yr</span>}
      />

      <div className="fn-summary">
        <StatTile label="Fortnightly" value={fmtMoneyRound(fnExpenses)} valueClassName="red" />
        <StatTile label="Monthly"     value={fmtMoneyRound(fnExpenses * 26 / 12)} valueClassName="red" />
        <StatTile label="Annual"      value={fmtMoneyRound(fnExpenses * 26)} valueClassName="red" />
      </div>

      <div className="cat-proportion-wrap">
        <div className="cat-proportion">
          {EXPENSE_GROUPS.map(g => {
            const amt = groupTotals[g.id] || 0;
            if (!amt) return null;
            return <div key={g.id} className="cp-segment" title={`${g.label}: ${fmtMoneyRound(amt)}/fn`}
              style={{ flex: amt, background: g.color }} />;
          })}
        </div>
        <div className="cat-legend">
          {EXPENSE_GROUPS.map(g => {
            const amt = groupTotals[g.id] || 0;
            if (!amt) return null;
            return (
              <div key={g.id} className="cl-item" style={{ cursor: 'default' }}>
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
  );
}
