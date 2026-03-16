import PropTypes from 'prop-types';
import {
  BarChart, Bar, Cell, XAxis, YAxis, ReferenceLine,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Icon from '../../components/Icon';
import { SectionHeader, Card } from '../../components/ui';
import { fmtMoney } from '../../utils/finance/tax';

// ── Chart helpers (same formatting as FinancesOverview) ─────────────────────
const DATE_FMT = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' });
function fmtDate(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  const color = val >= 0 ? 'var(--green)' : 'var(--red)';
  return (
    <div className="chart-tt">
      <div className="tt-date">{fmtDate(label)}</div>
      <div className="tt-bal" style={{ color }}>{val < 0 ? '\u2212' : ''}{fmtMoney(Math.abs(val))}</div>
    </div>
  );
}

/**
 * HomeCashflowTrend — fortnightly cashflow bar chart.
 *
 * Receives pre-computed points from useCashflowTrend via Home orchestrator.
 * Chart config mirrors FinancesOverview CashflowTrendSection.
 */
export default function HomeCashflowTrend({ points, hasData }) {
  if (!hasData) return null;

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="trend" size={15} /> Cashflow Trend</>}
        subtitle="fortnightly · last 26 fortnights"
      />
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            tickFormatter={v => `$${Math.abs(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <ReferenceLine y={0} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
          <Bar dataKey="cashflow" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {points.map((p, i) => (
              <Cell key={i} fill={p.cashflow >= 0 ? '#34C759' : '#FF3B30'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

HomeCashflowTrend.propTypes = {
  points:  PropTypes.arrayOf(PropTypes.shape({
    date:     PropTypes.string.isRequired,
    cashflow: PropTypes.number.isRequired,
  })).isRequired,
  hasData: PropTypes.bool.isRequired,
};
