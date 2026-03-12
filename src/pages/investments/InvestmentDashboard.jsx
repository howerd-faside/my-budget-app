import { useMemo } from 'react';
import { useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { calcPortfolioStats } from '../../utils/finance/savings';
import { getPortfolioActivity } from '../../utils/finance/transactions';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';

const CAT_COLOR = {
  'Shares':       '#0071E3',
  'ETF':          '#34C759',
  'Managed Fund': '#AF52DE',
  'Bonds':        '#FF9F0A',
  'Term Deposit': '#FF6B2B',
  'Crypto':       '#32ADE6',
  'Other':        '#86868B',
};

const fmt = (n) =>
  `$${Math.abs(+n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvestmentDashboard({ onSelectTab }) {
  const { selectedPortfolioId: pid, investments, investmentContributions, investmentDividends, investmentPortfolios } = useInvestment();
  const holdings      = (investments             || []).filter(h => h.portfolioId === pid);
  const contributions = (investmentContributions || []).filter(c => c.portfolioId === pid);
  const dividends     = (investmentDividends     || []).filter(d => d.portfolioId === pid);

  const stats = useMemo(
    () => calcPortfolioStats(holdings, contributions, dividends),
    [holdings, contributions, dividends]
  );

  const recentActivity = useMemo(
    () => getPortfolioActivity(contributions, dividends, holdings),
    [contributions, dividends, holdings]
  );

  const portfolios = investmentPortfolios || [];
  const hasData    = holdings.length > 0 || contributions.length > 0 || dividends.length > 0;

  if (portfolios.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="trend" size={38} />}
          title="Create a portfolio to start tracking your investments."
        />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="trend" size={38} />}
          title="No investment data yet. Start by adding your first holding."
          action={
            <button className="btn-ghost small" onClick={() => onSelectTab('inv-holdings')}>
              + Add Holding
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-content">

      {/* Summary tiles */}
      <div className="fn-summary">
        <StatTile label="Portfolio Value"   value={fmt(stats.totalValue)} />
        <StatTile label="Total Contributed" value={fmt(stats.totalContrib)} />
        <StatTile
          label="Unrealised Gain/Loss"
          value={`${stats.unrealised >= 0 ? '+' : '−'}${fmt(stats.unrealised)}`}
          valueClassName={stats.unrealised >= 0 ? 'green' : 'red'}
        />
        <StatTile label="Total Dividends"   value={fmt(stats.totalDivNet)} />
      </div>

      {/* Allocation */}
      {stats.allocation.length > 0 && (
        <Card variant="section">
          <SectionHeader title="Allocation" />
          <div className="cat-proportion-wrap">
            <div className="cat-proportion">
              {stats.allocation.map(({ cat, pct }) => (
                <div
                  key={cat}
                  className="cp-segment"
                  style={{ flex: Math.max(0.02, pct), background: CAT_COLOR[cat] || '#86868B' }}
                  title={`${cat}: ${(pct * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="cat-legend">
              {stats.allocation.map(({ cat, val, pct }) => (
                <div key={cat} className="cl-item">
                  <span className="cl-dot" style={{ background: CAT_COLOR[cat] || '#86868B' }} />
                  <span className="cl-label">{cat}</span>
                  <span className="cl-amt">{fmt(val)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {(pct * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Top holdings */}
      {holdings.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title="Holdings"
            actions={<button className="btn-ghost small" onClick={() => onSelectTab('inv-holdings')}>View all →</button>}
          />
          <div className="fn-list">
            {[...holdings]
              .sort((a, b) => ((+b.units * +b.currentPrice) || 0) - ((+a.units * +a.currentPrice) || 0))
              .slice(0, 5)
              .map(h => {
                const val  = (+h.units || 0) * (+h.currentPrice || 0);
                const cost = (+h.units || 0) * (+h.avgCost || 0);
                const gl   = val - cost;
                const color = CAT_COLOR[h.category] || '#86868B';
                return (
                  <div key={h.id} className="fn-row">
                    <div className="fn-main" style={{ cursor: 'default' }}>
                      <div className="fn-left">
                        <div className="fn-dates">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="fn-label">{h.name}</span>
                            {h.ticker && (
                              <span className="tag" style={{ fontFamily: 'var(--mono)', letterSpacing: 0 }}>
                                {h.ticker}
                              </span>
                            )}
                            <span className="tag" style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                              {h.category}
                            </span>
                          </div>
                          {h.platform && (
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{h.platform}</div>
                          )}
                        </div>
                      </div>
                      <div className="fn-right" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{fmt(val)}</span>
                        <span className="mono" style={{ fontSize: 11, color: gl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {gl >= 0 ? '+' : '−'}{fmt(gl)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <Card variant="section">
          <SectionHeader title="Recent Activity" />
          <div className="fn-list">
            {recentActivity.map(item => (
              <div key={`${item.type}-${item.id}`} className="fn-row">
                <div className="fn-main" style={{ cursor: 'default' }}>
                  <div className="fn-left">
                    <div className="fn-dates">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="fn-label">{item.holding}</span>
                        <span className={`dpill ${item.type === 'dividend' ? 'green' : 'teal'}`}>{item.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{item.date}</div>
                    </div>
                  </div>
                  <div className="fn-right">
                    <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmt(item.amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
