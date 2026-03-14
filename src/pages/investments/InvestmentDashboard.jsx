import { useMemo } from 'react';
import { useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { calcPortfolioStats } from '../../utils/finance/savings';
import { getPortfolioActivity } from '../../utils/finance/transactions';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';
import { useNavigate } from '../../contexts/NavigationContext';
import { CATEGORY_COLORS as CAT_COLOR } from '../../utils/colors';
import { fmtCurrency as fmt } from '../../utils/format';

export default function InvestmentDashboard() {
  const onSelectTab = useNavigate();
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

  const gainPct       = stats.totalContrib > 0 ? (stats.unrealised / stats.totalContrib) * 100 : null;
  const totalReturn   = stats.unrealised + stats.totalDivNet;
  const totalReturnPct = stats.totalContrib > 0 ? (totalReturn / stats.totalContrib) * 100 : null;

  const holdingsCols   = recentActivity.length > 0 ? 'dash-col-8' : 'dash-col-12';
  const activityCols   = holdings.length > 0       ? 'dash-col-4' : 'dash-col-12';

  return (
    <div className="page-content">

      {/* Row 1 — Portfolio Snapshot section */}
      <Card variant="section">
        <SectionHeader title={<><Icon name="wallet" size={15} /> Portfolio Snapshot</>} />
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
      </Card>

      {/* Row 2 — Analytics: allocation (8) + performance summary (4) */}
      {stats.allocation.length > 0 && (
        <div className="dash-grid">

          <Card variant="section" className="dash-col-8">
            <SectionHeader title={<><Icon name="layers" size={15} /> Allocation</>} />
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

          <Card variant="section" className="dash-col-4">
            <SectionHeader title={<><Icon name="arrow-up" size={15} /> Performance</>} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Unrealised Return</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: stats.unrealised >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {stats.unrealised >= 0 ? '+' : '−'}{fmt(stats.unrealised)}
                </div>
                {gainPct !== null && (
                  <div className="mono" style={{ fontSize: 13, color: stats.unrealised >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                    {stats.unrealised >= 0 ? '+' : ''}{gainPct.toFixed(1)}% on cost
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Total Return</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {totalReturn >= 0 ? '+' : '−'}{fmt(totalReturn)}
                </div>
                {totalReturnPct !== null && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    incl. {fmt(stats.totalDivNet)} dividends
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Holdings</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{holdings.length}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  across {stats.allocation.length} categor{stats.allocation.length === 1 ? 'y' : 'ies'}
                </div>
              </div>
            </div>
          </Card>

        </div>
      )}

      {/* Row 3 — Operational: holdings (8) + recent activity (4) */}
      <div className="dash-grid">

        {holdings.length > 0 && (
          <Card variant="section" className={holdingsCols}>
            <SectionHeader
              title={<><Icon name="tag" size={15} /> Holdings</>}
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

        {recentActivity.length > 0 && (
          <Card variant="section" className={activityCols}>
            <SectionHeader title={<><Icon name="swap" size={15} /> Recent Activity</>} />
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

    </div>
  );
}
