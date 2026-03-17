import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { usePortfolioAnalytics } from '../../store/hooks';
import Icon from '../../components/Icon';
import { fetchAssetHistoricalPrices, buildAssetPortfolioSeries, CHART_RANGES } from '../../utils/priceService';
import { buildUnitsTimeline, getUnitsAtDate, calcPeriodReturns } from '../../utils/finance/portfolio';
import { useToast } from '../../components/Toast';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';
import { CATEGORY_COLORS as CAT_COLOR } from '../../utils/colors';
import { fmtCurrency as fmt, fmtPct, fmtK } from '../../utils/format';

function formatAxisDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });
}
function formatAxisDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-NZ', { month: 'short', year: '2-digit' });
}

/** Date range start for period returns table. */
function periodStart(key) {
  const d = new Date();
  if (key === 'YTD') return `${d.getFullYear()}-01-01`;
  const days = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[key] || 365;
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const PERIOD_KEYS = ['1M', '3M', 'YTD', '1Y', 'All'];
const TODAY_STR = new Date().toISOString().slice(0, 10);

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="perf-tooltip">
      <div className="perf-tooltip-date">
        {new Date(label + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
      <div className="perf-tooltip-val mono">
        ${val.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

// ── Portfolio chart ───────────────────────────────────────────────────────────

function PortfolioChart({ assets, transactions }) {
  const toast = useToast();
  const [histMap, setHistMap] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [range,   setRange]   = useState('1Y');

  const hasTickers = assets.some(a => a.ticker?.trim());

  const series = useMemo(() => {
    if (!histMap) return [];
    return buildAssetPortfolioSeries(assets, transactions, histMap, range, buildUnitsTimeline, getUnitsAtDate);
  }, [histMap, assets, transactions, range]);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    try {
      const { histMap: map, skipped: skip } = await fetchAssetHistoricalPrices(assets);
      if (map.size === 0) throw new Error('No data returned — check tickers are valid symbols');
      setHistMap(map);
      setSkipped(skip);
    } catch (e) {
      setError(e.message);
      toast(`Failed to load price history — ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const startVal  = series[0]?.value || 0;
  const endVal    = series[series.length - 1]?.value || 0;
  const change    = endVal - startVal;
  const changePct = startVal > 0 ? change / startVal * 100 : 0;
  const isGain    = change >= 0;
  const lineColor = isGain ? '#34C759' : '#FF3B30';

  const axisFormatter = series.length > 120 ? formatAxisDateShort : formatAxisDate;
  const tickInterval  = Math.max(1, Math.floor(series.length / 6));

  return (
    <Card variant="section" className="perf-chart-card">

      {/* Top bar: title + load button */}
      <div className="perf-chart-topbar">
        <span className="perf-chart-title">Portfolio History <span className="perf-currency-tag">USD</span></span>
        {hasTickers && (
          <button className="btn-ghost small" onClick={handleLoad} disabled={loading} style={{ minWidth: 104 }}>
            {loading ? 'Loading…' : histMap ? '↻ Refresh' : '↓ Load History'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="perf-chart-error">{error}</div>
      )}

      {/* Skipped warning */}
      {skipped.length > 0 && histMap && (
        <div className="perf-chart-warning">
          {skipped.map(s => `${s.name}${s.ticker ? ` (${s.ticker})` : ''}`).join(', ')} excluded — {skipped[0]?.reason}
        </div>
      )}

      {/* Empty / loading hint */}
      {!histMap && !loading && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0 4px' }}>
          {hasTickers
            ? 'Load price history to see portfolio value over time.'
            : 'Add tickers to your assets to load price history.'}
        </div>
      )}
      {loading && (
        <div className="perf-chart-placeholder">
          <div className="perf-spinner" />
          <span>Fetching historical prices…</span>
        </div>
      )}

      {/* Value + range selector row */}
      {histMap && series.length > 0 && (
        <>
          <div className="perf-chart-valuebar">
            <div className="perf-chart-valueleft">
              <span className="perf-chart-bigval mono">
                ${endVal.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="perf-chart-delta mono" style={{ color: lineColor }}>
                {isGain ? '+' : '−'}${Math.abs(change).toLocaleString('en-NZ', { maximumFractionDigits: 0 })}
                &nbsp;({isGain ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </div>
            <div className="perf-range-tabs">
              {CHART_RANGES.map(r => (
                <button key={r} className={`perf-range-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={lineColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--text3)' }}
                tickLine={false} axisLine={false}
                tickFormatter={axisFormatter}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text3)' }}
                tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                width={48}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone" dataKey="value"
                stroke={lineColor} strokeWidth={2}
                fill="url(#portGrad)" dot={false}
                activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}

      {histMap && series.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px 0 4px' }}>
          No data for this range. Try a wider range or check purchase dates.
        </div>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InvestmentPerformance() {
  const {
    assets, enrichedAssets, transactions, overview, income,
  } = usePortfolioAnalytics();

  // ── Derived stats ──────────────────────────────────────────────────────────

  // Category breakdown with G/L per category
  const catBreakdown = useMemo(() => {
    const catMap = {};
    for (const ea of enrichedAssets) {
      const cat = ea.asset.category || 'Other';
      if (!catMap[cat]) catMap[cat] = { value: 0, cost: 0, realisedGL: 0 };
      catMap[cat].value      += ea.currentValue;
      catMap[cat].cost       += ea.position.totalCost;
      catMap[cat].realisedGL += ea.position.realisedGL;
    }
    return Object.entries(catMap)
      .map(([cat, d]) => ({
        cat,
        value: d.value,
        cost: d.cost,
        gl: d.value - d.cost,
        glPct: d.cost > 0 ? (d.value - d.cost) / d.cost * 100 : 0,
        pct: overview.totalValue > 0 ? d.value / overview.totalValue : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [enrichedAssets, overview.totalValue]);

  // Period returns
  const periodReturns = useMemo(() => {
    return PERIOD_KEYS.map(key => {
      const from = key === 'All' ? '0000-01-01' : periodStart(key);
      return { key, ...calcPeriodReturns(transactions, from, TODAY_STR) };
    });
  }, [transactions]);

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (assets.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="trend" size={38} />}
          title="No performance data yet."
        />
      </div>
    );
  }

  const isTotalGain    = overview.totalReturn >= 0;
  const isUnrealGain   = overview.unrealisedGL >= 0;
  const isRealisedGain = overview.realisedGL >= 0;

  return (
    <div className="page-content">

      {/* ── Portfolio history chart ── */}
      <PortfolioChart assets={assets} transactions={transactions} />

      {/* ── Performance KPIs ── */}
      <Card variant="section">
        <SectionHeader title={<><Icon name="trend" size={15} /> Performance Summary</>} />
        <div className="fn-summary">
          <StatTile
            label="Total Return"
            value={`${isTotalGain ? '+' : '−'}${fmt(overview.totalReturn)}`}
            valueClassName={isTotalGain ? 'green' : 'red'}
            meta={overview.totalCost > 0 ? fmtPct(overview.returnPct) + ' on cost' : null}
          />
          <StatTile
            label="Unrealised G/L"
            value={`${isUnrealGain ? '+' : '−'}${fmt(overview.unrealisedGL)}`}
            valueClassName={isUnrealGain ? 'green' : 'red'}
            meta={overview.totalCost > 0 ? fmtPct((overview.unrealisedGL / overview.totalCost) * 100) + ' on cost' : null}
          />
          <StatTile
            label="Realised G/L"
            value={`${isRealisedGain ? '+' : '−'}${fmt(overview.realisedGL)}`}
            valueClassName={isRealisedGain ? 'green' : 'red'}
          />
          <StatTile
            label="Dividend Income"
            value={fmt(income.dividendNet)}
            valueClassName="green"
            meta={income.dividendTax > 0 ? `${fmt(income.dividendGross)} gross · ${fmt(income.dividendTax)} RWT` : undefined}
          />
          {income.feesPaid > 0 && (
            <StatTile label="Fees Paid" value={fmt(income.feesPaid)} valueClassName="red" />
          )}
        </div>
      </Card>

      {/* ── Period returns table ── */}
      {transactions.length > 0 && (
        <Card variant="section">
          <SectionHeader title={<><Icon name="trend" size={15} /> Returns by Period</>} />
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="right">Invested</th>
                  <th className="right">Sold</th>
                  <th className="right">Realised</th>
                  <th className="right">Dividends</th>
                  <th className="right">Fees</th>
                  <th className="right">Txns</th>
                </tr>
              </thead>
              <tbody>
                {periodReturns.map(pr => {
                  const isPos = pr.realisedGL >= 0;
                  return (
                    <tr key={pr.key}>
                      <td style={{ fontWeight: 500 }}>{pr.key}</td>
                      <td className="right mono">{pr.invested > 0 ? fmt(pr.invested) : '—'}</td>
                      <td className="right mono">{pr.disposed > 0 ? fmt(pr.disposed) : '—'}</td>
                      <td className="right mono" style={{ color: pr.realisedGL !== 0 ? (isPos ? 'var(--green)' : 'var(--red)') : undefined }}>
                        {pr.realisedGL !== 0 ? `${isPos ? '+' : '−'}${fmt(pr.realisedGL)}` : '—'}
                      </td>
                      <td className="right mono" style={{ color: pr.dividendNet > 0 ? 'var(--green)' : undefined }}>
                        {pr.dividendNet > 0 ? fmt(pr.dividendNet) : '—'}
                      </td>
                      <td className="right mono" style={{ color: pr.feesPaid > 0 ? 'var(--red)' : undefined }}>
                        {pr.feesPaid > 0 ? fmt(pr.feesPaid) : '—'}
                      </td>
                      <td className="right mono">{pr.txCount || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Category breakdown + Asset detail ── */}
      <div className="dash-grid">

        {catBreakdown.length > 1 && (
          <Card variant="section" className="dash-col-4">
            <SectionHeader title={<><Icon name="layers" size={15} /> By Category</>} />
            <div className="perf-cat-list">
              {catBreakdown.map(c => {
                const color = CAT_COLOR[c.cat] || '#86868B';
                const isPos = c.gl >= 0;
                return (
                  <div key={c.cat} className="perf-cat-row2">
                    <div className="perf-cat2-left">
                      <span className="cl-dot" style={{ background: color }} />
                      <span className="perf-cat2-name">{c.cat}</span>
                    </div>
                    <div className="perf-cat2-bar-wrap">
                      <div
                        className="perf-cat2-bar"
                        style={{ width: `${c.pct * 100}%`, background: color }}
                      />
                    </div>
                    <div className="perf-cat2-right">
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                        {fmtK(c.value)}
                      </span>
                      <span className="perf-return-pill" style={{
                        background: isPos ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)',
                        color: isPos ? 'var(--green)' : 'var(--red)',
                      }}>
                        {fmtPct(c.glPct)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card variant="section" className={catBreakdown.length > 1 ? 'dash-col-8' : 'dash-col-12'}>
          <SectionHeader title={<><Icon name="tag" size={15} /> Asset Detail</>} />
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="right">Units</th>
                  <th className="right">Avg Cost</th>
                  <th className="right">Price</th>
                  <th className="right">Value</th>
                  <th className="right">Unrealised</th>
                  <th className="right">Realised</th>
                  <th className="right">Return</th>
                </tr>
              </thead>
              <tbody>
                {[...enrichedAssets]
                  .sort((a, b) => b.currentValue - a.currentValue)
                  .map(ea => {
                    const isPos = ea.unrealisedGL >= 0;
                    const isRePos = ea.position.realisedGL >= 0;
                    const color = CAT_COLOR[ea.asset.category] || '#86868B';
                    const hasPrice = ea.currentPrice > 0;
                    return (
                      <tr key={ea.asset.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span className="cl-dot" style={{ background: color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{ea.asset.name}</span>
                            {ea.asset.ticker && (
                              <span className="tag sm" style={{ fontFamily: 'var(--mono)', letterSpacing: 0 }}>
                                {ea.asset.ticker}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="right mono">
                          {ea.position.units > 0 ? ea.position.units.toLocaleString('en-NZ', { maximumFractionDigits: 4 }) : '—'}
                        </td>
                        <td className="right mono" style={{ color: 'var(--text2)' }}>
                          {ea.position.avgCost > 0 ? fmt(ea.position.avgCost) : '—'}
                        </td>
                        <td className="right mono" style={{ color: 'var(--text2)' }}>
                          {hasPrice ? fmt(ea.currentPrice) : <span style={{ color: 'var(--text3)' }}>No price</span>}
                        </td>
                        <td className="right mono" style={{ fontWeight: 600 }}>{fmt(ea.currentValue)}</td>
                        <td className="right mono" style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>
                          {ea.position.units > 0 ? `${isPos ? '+' : '−'}${fmt(ea.unrealisedGL)}` : '—'}
                        </td>
                        <td className="right mono" style={{ color: ea.position.realisedGL !== 0 ? (isRePos ? 'var(--green)' : 'var(--red)') : undefined }}>
                          {ea.position.realisedGL !== 0 ? `${isRePos ? '+' : '−'}${fmt(ea.position.realisedGL)}` : '—'}
                        </td>
                        <td className="right">
                          {ea.position.totalCost > 0 ? (
                            <span className="perf-return-pill" style={{
                              background: isPos ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)',
                              color: isPos ? 'var(--green)' : 'var(--red)',
                            }}>
                              {fmtPct(ea.unrealisedGLPct)}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>

      </div>

    </div>
  );
}
