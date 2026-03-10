import { useMemo } from 'react';
import { useApp } from '../../store';
import Icon from '../../components/Icon';

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
  const { state } = useApp();
  const pid           = state.selectedPortfolioId;
  const holdings      = (state.investments             || []).filter(h => h.portfolioId === pid);
  const contributions = (state.investmentContributions || []).filter(c => c.portfolioId === pid);
  const dividends     = (state.investmentDividends     || []).filter(d => d.portfolioId === pid);

  const stats = useMemo(() => {
    const totalValue   = holdings.reduce((s, h) => s + (+h.units || 0) * (+h.currentPrice || 0), 0);
    const totalCost    = holdings.reduce((s, h) => s + (+h.units || 0) * (+h.avgCost || 0), 0);
    const totalContrib = contributions.reduce((s, c) => s + (+c.amount || 0), 0);
    const totalDivNet  = dividends.reduce((s, d) => s + (+d.netAmount || 0), 0);
    const unrealised   = totalValue - totalCost;
    const returnPct    = totalCost > 0 ? (unrealised / totalCost * 100) : 0;

    const byCat = {};
    for (const h of holdings) {
      const val = (+h.units || 0) * (+h.currentPrice || 0);
      byCat[h.category] = (byCat[h.category] || 0) + val;
    }
    const allocation = Object.entries(byCat)
      .map(([cat, val]) => ({ cat, val, pct: totalValue > 0 ? val / totalValue : 0 }))
      .sort((a, b) => b.val - a.val);

    return { totalValue, totalCost, totalContrib, totalDivNet, unrealised, returnPct, allocation };
  }, [holdings, contributions, dividends]);

  const recentActivity = useMemo(() => {
    const contribItems = contributions.map(c => ({
      id: c.id, date: c.date, type: 'contribution',
      label: c.type || 'Contribution',
      holding: holdings.find(h => h.id === c.holdingId)?.name || c.platform || '—',
      amount: +c.amount || 0,
    }));
    const dividendItems = dividends.map(d => ({
      id: d.id, date: d.date, type: 'dividend',
      label: 'Dividend',
      holding: holdings.find(h => h.id === d.holdingId)?.name || d.platform || '—',
      amount: +d.netAmount || 0,
    }));
    return [...contribItems, ...dividendItems]
      .filter(x => x.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [contributions, dividends, holdings]);

  const portfolios = state.investmentPortfolios || [];
  const hasData    = holdings.length > 0 || contributions.length > 0 || dividends.length > 0;

  if (portfolios.length === 0) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="es-icon"><Icon name="trend" size={38} /></div>
          <div className="es-text">Create a portfolio to start tracking your investments.</div>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="es-icon"><Icon name="trend" size={38} /></div>
          <div className="es-text">No investment data yet. Start by adding your first holding.</div>
          <button className="btn-ghost small" onClick={() => onSelectTab('inv-holdings')}>
            + Add Holding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">

      {/* Summary tiles */}
      <div className="fn-summary">
        <div className="fns-item">
          <span>Portfolio Value</span>
          <div className="fns-val-row">
            <span className="mono">{fmt(stats.totalValue)}</span>
          </div>
        </div>
        <div className="fns-item">
          <span>Total Contributed</span>
          <div className="fns-val-row">
            <span className="mono">{fmt(stats.totalContrib)}</span>
          </div>
        </div>
        <div className="fns-item">
          <span>Unrealised Gain/Loss</span>
          <div className="fns-val-row">
            <span className="mono" style={{ color: stats.unrealised >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {stats.unrealised >= 0 ? '+' : '−'}{fmt(stats.unrealised)}
            </span>
          </div>
        </div>
        <div className="fns-item">
          <span>Total Dividends</span>
          <div className="fns-val-row">
            <span className="mono">{fmt(stats.totalDivNet)}</span>
          </div>
        </div>
      </div>

      {/* Allocation */}
      {stats.allocation.length > 0 && (
        <div className="dash-section">
          <div className="section-header"><h3>Allocation</h3></div>
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
        </div>
      )}

      {/* Top holdings */}
      {holdings.length > 0 && (
        <div className="dash-section">
          <div className="section-header">
            <h3>Holdings</h3>
            <button className="btn-ghost small" onClick={() => onSelectTab('inv-holdings')}>View all →</button>
          </div>
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
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="dash-section">
          <div className="section-header"><h3>Recent Activity</h3></div>
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
        </div>
      )}
    </div>
  );
}
