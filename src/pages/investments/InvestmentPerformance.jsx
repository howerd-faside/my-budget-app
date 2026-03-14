import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { fetchAllHistoricalPrices, buildPortfolioSeries, CHART_RANGES } from '../../utils/priceService';
import { useToast } from '../../components/Toast';
import { calcPortfolioStats, enrichHoldings } from '../../utils/finance/savings';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';
import { CATEGORY_COLORS as CAT_COLOR } from '../../utils/colors';
import { fmtCurrency as fmt, fmtPct, timeAgo } from '../../utils/format';

const fmtK = (n) => {
  const abs = Math.abs(+n || 0);
  return abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
};

function formatAxisDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });
}
function formatAxisDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-NZ', { month: 'short', year: '2-digit' });
}

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

function PortfolioChart({ holdings }) {
  const toast = useToast();
  const [histMap, setHistMap] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [range,   setRange]   = useState('1Y');

  const series = useMemo(() => {
    if (!histMap) return [];
    return buildPortfolioSeries(holdings, histMap, range);
  }, [histMap, holdings, range]);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    try {
      const { histMap: map, skipped: skip } = await fetchAllHistoricalPrices(holdings);
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
        <button className="btn-ghost small" onClick={handleLoad} disabled={loading} style={{ minWidth: 104 }}>
          {loading ? 'Loading…' : histMap ? '↻ Refresh' : '↓ Load History'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="perf-chart-error">{error}</div>
      )}

      {/* Skipped warning */}
      {skipped.length > 0 && histMap && (
        <div className="perf-chart-warning">
          ⚠ {skipped.map(s => `${s.name}${s.ticker ? ` (${s.ticker})` : ''}`).join(', ')} excluded — {skipped[0]?.reason}
        </div>
      )}

      {/* Empty / loading placeholder */}
      {!histMap && !loading && (
        <div className="perf-chart-placeholder">
          <Icon name="trend" size={30} />
          <span>Load 2 years of daily prices to see portfolio history</span>
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
        <div className="perf-chart-placeholder">
          <span>No data for this range. Try a wider range or check purchase dates.</span>
        </div>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InvestmentPerformance() {
  const { selectedPortfolioId: pid, investments } = useInvestment();
  const holdings = (investments || []).filter(h => h.portfolioId === pid);

  const stats = useMemo(() => {
    const { totalValue, totalCost, unrealised, returnPct } = calcPortfolioStats(holdings, [], []);
    const enriched = enrichHoldings(holdings);

    // Category breakdown
    const catMap = {};
    for (const h of enriched) {
      if (!catMap[h.category]) catMap[h.category] = { value: 0, cost: 0 };
      catMap[h.category].value += h.value;
      catMap[h.category].cost  += h.cost;
    }
    const categories = Object.entries(catMap)
      .map(([cat, d]) => ({
        cat, value: d.value, cost: d.cost,
        gl:    d.value - d.cost,
        glPct: d.cost > 0 ? (d.value - d.cost) / d.cost * 100 : 0,
        pct:   totalValue > 0 ? d.value / totalValue : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // Rankings
    const ranked = [...enriched]
      .filter(h => h.cost > 0)
      .sort((a, b) => b.glPct - a.glPct);
    const maxAbsGlPct = Math.max(...ranked.map(h => Math.abs(h.glPct)), 1);

    const lastUpdated = holdings.map(h => h.priceUpdatedAt).filter(Boolean).sort().pop();

    return { totalValue, totalCost, unrealised, returnPct, categories, ranked, maxAbsGlPct, lastUpdated };
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <div className="page-content">
        <EmptyState
          icon={<Icon name="trend" size={38} />}
          title="Add holdings with cost and current price to see performance."
        />
      </div>
    );
  }

  const isGain = stats.unrealised >= 0;

  return (
    <div className="page-content">

      {/* ── Portfolio history chart ── */}
      <PortfolioChart holdings={holdings} />

      {/* ── 4-stat snapshot strip ── */}
      <div className="fn-summary">
        <StatTile label="Portfolio Value" value={fmt(stats.totalValue)} />
        <StatTile label="Cost Basis"      value={fmt(stats.totalCost)} />
        <StatTile
          label="Unrealised G/L"
          value={`${isGain ? '+' : '−'}${fmt(Math.abs(stats.unrealised))}`}
          valueClassName={isGain ? 'green' : 'red'}
        />
        <div className="fns-item">
          <span>Total Return{stats.lastUpdated ? <span style={{ fontWeight: 400, color: 'var(--text3)' }}> · {timeAgo(stats.lastUpdated)}</span> : ''}</span>
          <div className="fns-val-row">
            <span className="mono" style={{ color: isGain ? 'var(--green)' : 'var(--red)', fontSize: 18, fontWeight: 700 }}>
              {fmtPct(stats.returnPct)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Middle: category breakdown + performance ranking ── */}
      <div className="perf-mid-grid">

        {/* Category breakdown */}
        {stats.categories.length > 1 && (
          <Card variant="section">
            <SectionHeader title={<><Icon name="layers" size={15} /> By Category</>} />
            <div className="perf-cat-list">
              {stats.categories.map(c => {
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
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>
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

        {/* Rankings */}
        {stats.ranked.length > 0 && (
          <Card variant="section">
            <SectionHeader title={<><Icon name="sortaz" size={15} /> Ranked by Return</>} />
            <div className="perf-rank-list">
              {stats.ranked.map((h, i) => {
                const color   = CAT_COLOR[h.category] || '#86868B';
                const isPos   = h.gl >= 0;
                const barPct  = Math.min(100, Math.abs(h.glPct) / stats.maxAbsGlPct * 100);
                return (
                  <div key={h.id} className="perf-rank-row">
                    <span className="perf-rank-num">{i + 1}</span>
                    <span className="cl-dot" style={{ background: color, flexShrink: 0 }} />
                    <div className="perf-rank-info">
                      <span className="perf-rank-name">{h.name}</span>
                      {h.ticker && (
                        <span className="tag" style={{ fontFamily: 'var(--mono)', letterSpacing: 0, fontSize: 10 }}>
                          {h.ticker}
                        </span>
                      )}
                    </div>
                    <div className="perf-rank-bar-wrap">
                      <div className="perf-rank-bar" style={{
                        width: `${barPct}%`,
                        background: isPos ? 'var(--green)' : 'var(--red)',
                      }} />
                    </div>
                    <span className="perf-return-pill" style={{
                      background: isPos ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)',
                      color: isPos ? 'var(--green)' : 'var(--red)',
                      minWidth: 64, textAlign: 'right',
                    }}>
                      {fmtPct(h.glPct)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* ── Holdings detail table ── */}
      <Card variant="section">
        <SectionHeader title={<><Icon name="tag" size={15} /> Holdings Detail</>} />
        <div className="perf-table-wrap">
          <table className="perf-table">
            <thead>
              <tr>
                <th>Holding</th>
                <th className="right">Units</th>
                <th className="right">Avg Cost</th>
                <th className="right">Price</th>
                <th className="right">Value</th>
                <th className="right">G/L</th>
                <th className="right">Return</th>
              </tr>
            </thead>
            <tbody>
              {[...holdings].sort((a, b) => {
                const va = (+a.units || 0) * (+a.currentPrice || 0);
                const vb = (+b.units || 0) * (+b.currentPrice || 0);
                return vb - va;
              }).map(h => {
                const units = +h.units || 0;
                const value = units * (+h.currentPrice || 0);
                const cost  = units * (+h.avgCost      || 0);
                const gl    = value - cost;
                const glPct = cost > 0 ? (gl / cost * 100) : 0;
                const isPos = gl >= 0;
                const color = CAT_COLOR[h.category] || '#86868B';
                return (
                  <tr key={h.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span className="cl-dot" style={{ background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{h.name}</span>
                        {h.ticker && (
                          <span className="tag" style={{ fontFamily: 'var(--mono)', letterSpacing: 0, fontSize: 10 }}>
                            {h.ticker}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="right mono">{units.toLocaleString('en-NZ', { maximumFractionDigits: 4 })}</td>
                    <td className="right mono" style={{ color: 'var(--text2)' }}>{h.avgCost ? fmt(h.avgCost) : '—'}</td>
                    <td className="right mono" style={{ color: 'var(--text2)' }}>{h.currentPrice ? fmt(h.currentPrice) : '—'}</td>
                    <td className="right mono" style={{ fontWeight: 600 }}>{fmt(value)}</td>
                    <td className="right mono" style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>
                      {isPos ? '+' : '−'}{fmt(Math.abs(gl))}
                    </td>
                    <td className="right">
                      <span className="perf-return-pill" style={{
                        background: isPos ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)',
                        color: isPos ? 'var(--green)' : 'var(--red)',
                      }}>
                        {fmtPct(glPct)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
