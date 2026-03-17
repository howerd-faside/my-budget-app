import {
  BarChart, Bar, Cell, XAxis, YAxis, ReferenceLine,
  CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import Icon from '../components/Icon';
import { SectionHeader, StatTile, Card, EmptyState } from '../components/ui';
import { useNavigate } from '../contexts/NavigationContext';
import {
  useHouseholdSnapshot, useMoneyFlow, useCashflowTrend,
  useObligationsSnapshot, useSavingsPosition,
} from '../store/hooks';
import { fmtMoney } from '../utils/finance/tax';
import { fmtChartDate } from '../utils/format';

const TREND_TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--sep2)',
  borderRadius: 12,
  boxShadow: 'var(--shadow-md)',
  padding: 0,
};

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  const color = val >= 0 ? 'var(--green)' : 'var(--red)';
  return (
    <div className="chart-tt">
      <div className="tt-date">{fmtChartDate(label)}</div>
      <div className="tt-bal" style={{ color }}>{val < 0 ? '−' : ''}{fmtMoney(Math.abs(val))}</div>
    </div>
  );
}

// ── Cashflow Trend Section ────────────────────────────────────────────────────
function CashflowTrendSection() {
  const { points, hasData } = useCashflowTrend();

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="trend" size={15} /> Cashflow Trend</>}
        subtitle="fortnightly · last 26 fortnights"
      />

      {!hasData ? (
        <EmptyState title="Add income or expenses to see your cashflow trend" />
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtChartDate}
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
            <Tooltip content={<TrendTooltip />} contentStyle={TREND_TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <ReferenceLine y={0} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
            <Bar dataKey="cashflow" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {points.map((p, i) => (
                <Cell key={i} fill={p.cashflow >= 0 ? '#34C759' : '#FF3B30'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ── Money Flow bucket definitions ─────────────────────────────────────────────
const FLOW_BUCKETS = [
  { key: 'mortgage',    label: 'Mortgage',     icon: '🏦', color: '#0071E3' },
  { key: 'livingCosts', label: 'Living Costs',  icon: '🛒', color: '#f97316' },
  { key: 'investments', label: 'Investments',   icon: '📈', color: '#34C759' },
  { key: 'savings',     label: 'Savings',       icon: '💰', color: '#AF52DE' },
];

// ── Money Flow Section ────────────────────────────────────────────────────────
function MoneyFlowSection() {
  const flow = useMoneyFlow();
  const { netIncome, mortgage, livingCosts, investments, savings } = flow;

  // Only positive values form proportion bar segments
  const barBase = Math.max(netIncome, mortgage + livingCosts + investments, 0.01);

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="swap" size={15} /> Money Flow</>}
        subtitle="fortnightly allocation"
      />

      {/* Allocation bar */}
      <div className="cat-proportion-wrap">
        <div className="cat-proportion">
          {FLOW_BUCKETS.map(b => {
            const amt = flow[b.key];
            if (amt <= 0) return null;
            return (
              <div
                key={b.key}
                className="cp-segment"
                title={`${b.label}: ${fmtMoney(amt)}/fn`}
                style={{ flex: amt / barBase, background: b.color }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="cat-legend">
          {FLOW_BUCKETS.map(b => {
            const amt    = flow[b.key];
            const pct    = netIncome > 0 ? Math.round(Math.abs(amt) / netIncome * 100) : 0;
            const isDeficit = b.key === 'savings' && amt < 0;
            return (
              <div key={b.key} className="cl-item" style={{ cursor: 'default' }}>
                <div className="cl-dot" style={{ background: isDeficit ? 'var(--red)' : b.color }} />
                <span className="cl-icon">{b.icon}</span>
                <span className="cl-label">{isDeficit ? 'Deficit' : b.label}</span>
                <span className="cl-amt" style={isDeficit ? { color: 'var(--red)' } : undefined}>
                  {isDeficit ? `−${fmtMoney(Math.abs(amt))}` : fmtMoney(amt)}
                </span>
                <span className="cl-amt" style={{ color: 'var(--text3)', fontWeight: 400 }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ── Obligations Snapshot Section ─────────────────────────────────────────────
function ObligationsSnapshotSection() {
  const goTab = useNavigate();
  const { totalBalance, repaymentFn, totalInterest, payoffYear, hasLoans } = useObligationsSnapshot();

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="mortgage" size={15} /> Obligations Snapshot</>}
        actions={<button className="btn-ghost small" onClick={() => goTab('mortgage')}>View Mortgage →</button>}
      />

      {!hasLoans ? (
        <EmptyState title="No loans configured. Add a loan in the Mortgage tab." />
      ) : (
        <div className="fn-summary">
          <StatTile label="Total Outstanding"  value={fmtMoney(totalBalance)} valueClassName="red" />
          <StatTile label="Repayment /fn"       value={fmtMoney(repaymentFn)}  valueClassName="red" />
          <StatTile label="Total Interest Left" value={fmtMoney(totalInterest)} />
          <StatTile label="Payoff Year"         value={payoffYear ?? '—'} />
        </div>
      )}
    </Card>
  );
}

// ── Savings Position Section ─────────────────────────────────────────────────
function SavingsPositionSection() {
  const { currentBalance, yearEndBalance, fortnightlyCashflow, sparkline } = useSavingsPosition();
  const thisYear = new Date().getFullYear();
  const cashflowAccent = fortnightlyCashflow >= 0 ? 'positive' : 'negative';

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="wallet" size={15} /> Savings Position</>}
        subtitle="12-month projection"
      />

      <div className="fn-summary" style={{ marginBottom: sparkline.length > 1 ? 14 : 0 }}>
        <StatTile label="Current Balance"         value={fmtMoney(currentBalance)} valueClassName="green" />
        <StatTile label={`Projected ${thisYear}`}  value={fmtMoney(yearEndBalance)} valueClassName="green" />
        <StatTile
          label="Cashflow /fn"
          value={`${fortnightlyCashflow >= 0 ? '+' : '−'}${fmtMoney(Math.abs(fortnightlyCashflow))}`}
          valueClassName={cashflowAccent === 'positive' ? 'green' : 'red'}
        />
      </div>

      {sparkline.length > 1 && (
        <ResponsiveContainer width="100%" height={72}>
          <AreaChart data={sparkline} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="savingsMiniGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0071E3" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="chart-tt">
                    <div className="tt-date">{payload[0]?.payload?.month}</div>
                    <div className="tt-bal">{fmtMoney(payload[0]?.value ?? 0)}</div>
                  </div>
                );
              }}
              cursor={{ stroke: 'rgba(0,113,227,0.2)', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#0071E3"
              strokeWidth={1.5}
              fill="url(#savingsMiniGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FinancesOverview() {
  const snap = useHouseholdSnapshot();
  const savingsPct = `${Math.round(snap.savingsRate * 100)}%`;

  return (
    <div className="page-content">

      {/* ── 1. Household Snapshot ─────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader title={<><Icon name="home" size={15} /> Household Snapshot</>} />
        <div className="fn-summary">
          <StatTile label="Net Fortnightly Income" value={fmtMoney(snap.netIncome)} />
          <StatTile label="Total Fortnightly Spend" value={fmtMoney(snap.totalSpend)} />
          <StatTile
            label="Net Cashflow"
            value={fmtMoney(snap.netCashflow)}
            valueClassName={snap.netCashflow >= 0 ? 'green' : 'red'}
          />
          <StatTile
            label="Savings Rate"
            value={savingsPct}
            valueClassName={snap.savingsRate >= 0 ? 'green' : 'red'}
          />
        </div>
      </Card>

      {/* ── 2. Money Flow ─────────────────────────────────────────────────── */}
      <MoneyFlowSection />

      {/* ── 3. Cashflow Trend ─────────────────────────────────────────────── */}
      <CashflowTrendSection />

      {/* ── 4. Obligations Snapshot ───────────────────────────────────────── */}
      <ObligationsSnapshotSection />

      {/* ── 5. Savings Position ───────────────────────────────────────────── */}
      <SavingsPositionSection />

    </div>
  );
}
