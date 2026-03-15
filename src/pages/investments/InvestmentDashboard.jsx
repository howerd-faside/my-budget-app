import { useState } from 'react';
import { usePortfolioAnalytics, useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';
import { useNavigate } from '../../contexts/NavigationContext';
import { CATEGORY_COLORS as CAT_COLOR } from '../../utils/colors';
import { fmtCurrency as fmt, fmtPct } from '../../utils/format';
import { INV_TX_TYPE_PILL } from '../../models/InvestmentTransaction';

const ALLOC_TABS = [
  { key: 'category', label: 'Category' },
  { key: 'platform', label: 'Platform' },
  { key: 'asset',    label: 'Asset'    },
];

const TYPE_LABELS = {
  buy: 'Buy', sell: 'Sell', dividend: 'Dividend', fee: 'Fee',
  deposit: 'Deposit', withdrawal: 'Withdrawal', transfer: 'Transfer',
};

export default function InvestmentDashboard() {
  const onSelectTab = useNavigate();
  const { investmentPortfolios } = useInvestment();
  const {
    assets, enrichedAssets, overview, income, activity, allocationBy,
  } = usePortfolioAnalytics();

  const [allocTab, setAllocTab] = useState('category');

  const portfolios = investmentPortfolios || [];
  const hasData    = assets.length > 0;

  // ── Empty states ───────────────────────────────────────────────────────────

  if (portfolios.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="trend" size={38} />}
          title="Create a portfolio to get started."
        />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="trend" size={38} />}
          title="No assets yet. Add your first investment."
          action={
            <button className="btn-ghost small" onClick={() => onSelectTab('inv-assets')}>
              + Add Asset
            </button>
          }
        />
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const allocation = allocationBy(allocTab);

  const top5 = [...enrichedAssets]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5);

  const holdingsCols  = activity.length > 0 ? 'dash-col-8' : 'dash-col-12';
  const activityCols  = top5.length > 0     ? 'dash-col-4' : 'dash-col-12';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">

      {/* Row 1 — Portfolio Snapshot */}
      <Card variant="section">
        <SectionHeader title={<><Icon name="wallet" size={15} /> Portfolio Snapshot</>} />
        <div className="fn-summary">
          <StatTile label="Portfolio Value"   value={fmt(overview.totalValue)} />
          <StatTile label="Total Invested"    value={fmt(overview.totalCost)} />
          <StatTile
            label="Unrealised G/L"
            value={`${overview.unrealisedGL >= 0 ? '+' : '−'}${fmt(overview.unrealisedGL)}`}
            valueClassName={overview.unrealisedGL >= 0 ? 'green' : 'red'}
            meta={overview.totalCost > 0 ? fmtPct((overview.unrealisedGL / overview.totalCost) * 100) + ' on cost' : null}
          />
          <StatTile
            label="Realised G/L"
            value={`${overview.realisedGL >= 0 ? '+' : '−'}${fmt(overview.realisedGL)}`}
            valueClassName={overview.realisedGL >= 0 ? 'green' : 'red'}
          />
          <StatTile
            label="Total Return"
            value={`${overview.totalReturn >= 0 ? '+' : '−'}${fmt(overview.totalReturn)}`}
            valueClassName={overview.totalReturn >= 0 ? 'green' : 'red'}
            meta={overview.totalCost > 0 ? fmtPct(overview.returnPct) + ' on cost' : null}
          />
          <StatTile
            label="Dividend Income"
            value={fmt(income.dividendNet)}
            valueClassName="green"
            meta={income.dividendTax > 0 ? `${fmt(income.dividendGross)} gross · ${fmt(income.dividendTax)} RWT` : null}
          />
        </div>
      </Card>

      {/* Row 2 — Allocation (full-width) */}
      {allocation.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="layers" size={15} /> Allocation</>}
            actions={
              <div className="filter-tabs" style={{ gap: 0 }}>
                {ALLOC_TABS.map(t => (
                  <button
                    key={t.key}
                    className={`filter-tab${allocTab === t.key ? ' active' : ''}`}
                    onClick={() => setAllocTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            }
          />
          <div className="cat-proportion-wrap">
            <div className="cat-proportion">
              {allocation.map(({ cat, pct }) => (
                <div
                  key={cat}
                  className="cp-segment"
                  style={{ flex: Math.max(0.02, pct), background: CAT_COLOR[cat] || '#86868B' }}
                  title={`${cat}: ${(pct * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="cat-legend">
              {allocation.map(({ cat, val, pct }) => (
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

      {/* Row 3 — Top Assets + Recent Activity */}
      <div className="dash-grid">

        {top5.length > 0 && (
          <Card variant="section" className={holdingsCols}>
            <SectionHeader
              title={<><Icon name="tag" size={15} /> Top Assets</>}
              actions={<button className="btn-ghost small" onClick={() => onSelectTab('inv-assets')}>View all →</button>}
            />
            <div className="fn-list">
              {top5.map(ea => (
                <div key={ea.asset.id} className="fn-row">
                  <div className="fn-main" style={{ cursor: 'default' }}>
                    <div className="fn-left">
                      <div className="fn-dates">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="fn-label">{ea.asset.name}</span>
                          {ea.asset.ticker && (
                            <span className="tag sm" style={{ fontFamily: 'var(--mono)', letterSpacing: 0 }}>
                              {ea.asset.ticker}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="fn-right" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{fmt(ea.currentValue)}</span>
                      <span className="mono" style={{ fontSize: 11, color: ea.unrealisedGL >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {ea.unrealisedGL >= 0 ? '+' : '−'}{fmt(ea.unrealisedGL)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activity.length > 0 && (
          <Card variant="section" className={activityCols}>
            <SectionHeader title={<><Icon name="swap" size={15} /> Recent Activity</>} />
            <div className="fn-list">
              {activity.map(item => (
                <div key={item.tx.id} className="fn-row">
                  <div className="fn-main" style={{ cursor: 'default' }}>
                    <div className="fn-left">
                      <div className="fn-dates">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="fn-label">{item.assetName || item.tx.label || TYPE_LABELS[item.tx.type] || item.tx.type}</span>
                          <span className={`dpill ${INV_TX_TYPE_PILL[item.tx.type] || ''}`}>{TYPE_LABELS[item.tx.type] || item.tx.type}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{item.tx.date}</div>
                      </div>
                    </div>
                    <div className="fn-right">
                      <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmt(item.tx.amount)}</span>
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
