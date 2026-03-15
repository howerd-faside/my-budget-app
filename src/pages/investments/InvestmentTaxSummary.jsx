import { useState, useMemo } from 'react';
import { usePortfolioAnalytics } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';
import {
  filterTxByYear,
  calcPeriodReturns,
  calcRealisedSells,
} from '../../utils/finance/portfolio';
import { fmtCurrency as fmt } from '../../utils/format';
import { exportCSV } from '../../utils/csvExport';

const YEAR_WINDOW = 7;
const THIS_YEAR   = new Date().getFullYear();

// ── Main component ────────────────────────────────────────────────────────────

export default function InvestmentTaxSummary() {
  const { assets, transactions } = usePortfolioAnalytics();

  const [year,         setYear]         = useState(THIS_YEAR);
  const [windowStart,  setWindowStart]  = useState(THIS_YEAR - 2);
  const [yearAnimKey,  setYearAnimKey]  = useState(0);
  const [yearSlideDir, setYearSlideDir] = useState(0);

  const windowYears  = Array.from({ length: YEAR_WINDOW }, (_, i) => windowStart + i);
  const selectedIdx  = windowYears.indexOf(year);
  const yearAnimClass = yearSlideDir > 0 ? 'anim-slide-right' : yearSlideDir < 0 ? 'anim-slide-left' : '';

  const changeYear = (newYear) => {
    if (newYear === year) return;
    setYearSlideDir(newYear > year ? 1 : -1);
    setYearAnimKey(k => k + 1);
    setYear(newYear);
  };

  const shiftWindow = (dir) => setWindowStart(s => s + dir);

  // ── Derived data ────────────────────────────────────────────────────────────

  const yearStr = String(year);
  const from    = `${year}-01-01`;
  const to      = `${year}-12-31`;

  const yearTxs = useMemo(
    () => filterTxByYear(transactions, yearStr),
    [transactions, yearStr],
  );

  const period = useMemo(
    () => calcPeriodReturns(transactions, from, to),
    [transactions, from, to],
  );

  const realisedSells = useMemo(
    () => calcRealisedSells(transactions, assets, from, to),
    [transactions, assets, from, to],
  );

  // Year's dividends for the detail list
  const yearDividends = useMemo(() => {
    const nameMap = {};
    for (const a of assets) nameMap[a.id] = a.name;
    return yearTxs
      .filter(tx => tx.type === 'dividend')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(tx => ({ ...tx, assetName: nameMap[tx.assetId] || '' }));
  }, [yearTxs, assets]);

  // Year's fees for the detail list
  const yearFees = useMemo(() => {
    const nameMap = {};
    for (const a of assets) nameMap[a.id] = a.name;
    return yearTxs
      .filter(tx => tx.type === 'fee')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(tx => ({ ...tx, assetName: nameMap[tx.assetId] || tx.label || 'Fee' }));
  }, [yearTxs, assets]);

  // Cash flow summary rows
  const cashFlow = useMemo(() => {
    const types = ['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'fee'];
    const labels = { buy: 'Purchases', sell: 'Sales', deposit: 'Deposits', withdrawal: 'Withdrawals', dividend: 'Dividends', fee: 'Fees' };
    return types
      .map(type => {
        const txs = yearTxs.filter(tx => tx.type === type);
        const total = txs.reduce((s, tx) => s + tx.amount, 0);
        return { type, label: labels[type], count: txs.length, total };
      })
      .filter(r => r.count > 0);
  }, [yearTxs]);

  const hasData = yearTxs.length > 0;

  // ── CSV export ──────────────────────────────────────────────────────────────

  const handleExport = () => {
    const rows = [];

    // Dividends section
    if (yearDividends.length > 0) {
      rows.push(['--- Dividends ---', '', '', '', '']);
      rows.push(['Date', 'Asset', 'Gross', 'Tax Withheld', 'Net']);
      for (const d of yearDividends) {
        rows.push([d.date, d.assetName, (d.grossAmount ?? 0).toFixed(2), (d.taxAmount ?? 0).toFixed(2), d.amount.toFixed(2)]);
      }
      rows.push(['', '', period.dividendGross.toFixed(2), period.dividendTax.toFixed(2), period.dividendNet.toFixed(2)]);
      rows.push([]);
    }

    // Realised sells section
    if (realisedSells.length > 0) {
      rows.push(['--- Realised Gains/Losses ---', '', '', '', '', '']);
      rows.push(['Date', 'Asset', 'Units', 'Proceeds', 'Cost Basis', 'Gain/Loss']);
      for (const s of realisedSells) {
        rows.push([s.tx.date, s.assetName, (s.tx.units ?? 0).toString(), s.proceeds.toFixed(2), s.costBasis.toFixed(2), s.gainLoss.toFixed(2)]);
      }
      const totalGL = realisedSells.reduce((s, r) => s + r.gainLoss, 0);
      rows.push(['', '', '', '', 'Total', totalGL.toFixed(2)]);
      rows.push([]);
    }

    // Cash flow section
    if (cashFlow.length > 0) {
      rows.push(['--- Cash Flow ---', '', '']);
      rows.push(['Type', 'Count', 'Total']);
      for (const c of cashFlow) {
        rows.push([c.label, c.count.toString(), c.total.toFixed(2)]);
      }
      rows.push([]);
    }

    // Fees section
    if (yearFees.length > 0) {
      rows.push(['--- Fees ---', '', '']);
      rows.push(['Date', 'Description', 'Amount']);
      for (const f of yearFees) {
        rows.push([f.date, f.assetName, f.amount.toFixed(2)]);
      }
    }

    const maxCols = Math.max(...rows.map(r => r.length), 1);
    const padded = rows.map(r => {
      while (r.length < maxCols) r.push('');
      return r;
    });

    exportCSV(
      `investment-report-${year}.csv`,
      Array.from({ length: maxCols }, (_, i) => `Col${i + 1}`),
      padded,
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">

      {/* ── Year bar ── */}
      <div className="year-bar">
        <button className="year-nav-btn" onClick={() => shiftWindow(-1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8l5 5"/>
          </svg>
        </button>
        <div className="year-pills">
          {selectedIdx >= 0 && (
            <div
              className="year-pill-indicator"
              style={{ transform: `translateX(${selectedIdx * 100}%)` }}
            />
          )}
          {windowYears.map(y => (
            <button
              key={y}
              className={`year-pill ${year === y ? 'active' : ''}`}
              onClick={() => changeYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
        <button className="year-nav-btn" onClick={() => shiftWindow(1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3l5 5-5 5"/>
          </svg>
        </button>
      </div>

      {/* ── Animated content ── */}
      <div key={yearAnimKey} className={`year-content ${yearAnimClass}`}>

        {!hasData ? (
          <EmptyState
            icon={<Icon name="clipboard" size={38} />}
            title={`No investment activity recorded for ${year}.`}
          />
        ) : (
          <>
            {/* ── Summary tiles ── */}
            <div className="fn-summary">
              <StatTile
                label="Dividends Received"
                value={fmt(period.dividendNet)}
                valueClassName="green"
                meta={period.dividendTax > 0 ? `Gross ${fmt(period.dividendGross)}` : undefined}
              />
              <StatTile
                label="Tax Withheld"
                value={fmt(period.dividendTax)}
                valueClassName={period.dividendTax > 0 ? 'red' : undefined}
                meta={period.dividendGross > 0 ? `${((period.dividendTax / period.dividendGross) * 100).toFixed(1)}% effective` : undefined}
              />
              <StatTile
                label="Realised G/L"
                value={`${period.realisedGL >= 0 ? '+' : '−'}${fmt(period.realisedGL)}`}
                valueClassName={period.realisedGL >= 0 ? 'green' : 'red'}
                meta={realisedSells.length > 0 ? `${realisedSells.length} disposal${realisedSells.length > 1 ? 's' : ''}` : undefined}
              />
              <StatTile
                label="Invested"
                value={fmt(period.invested)}
                meta={`${yearTxs.filter(tx => tx.type === 'buy').length} buys`}
              />
              <StatTile
                label="Disposed"
                value={fmt(period.disposed)}
                meta={`${yearTxs.filter(tx => tx.type === 'sell').length} sells`}
              />
              {period.feesPaid > 0 && (
                <StatTile
                  label="Fees Paid"
                  value={fmt(period.feesPaid)}
                  valueClassName="red"
                />
              )}
            </div>

            {/* ── Export button ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button className="btn-ghost small" onClick={handleExport}>
                ↓ Export CSV
              </button>
            </div>

            {/* ── Dividend report ── */}
            {yearDividends.length > 0 && (
              <Card variant="section">
                <SectionHeader title={<><Icon name="arrow-down" size={15} /> Dividend Report — {year}</>} />

                <div style={{ marginBottom: 16 }}>
                  <div className="tax-breakdown">
                    <div className="tb-row">
                      <span>Gross dividends</span>
                      <span className="mono">{fmt(period.dividendGross)}</span>
                    </div>
                    <div className="tb-row red">
                      <span>Tax withheld (RWT)</span>
                      <span className="mono">{fmt(period.dividendTax)}</span>
                    </div>
                    <div className="tb-divider" />
                    <div className="tb-row bold green">
                      <span>Net dividends received</span>
                      <span className="mono">{fmt(period.dividendNet)}</span>
                    </div>
                  </div>
                </div>

                <div className="perf-table-wrap">
                  <table className="perf-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Asset</th>
                        <th className="right">Gross</th>
                        <th className="right">Tax</th>
                        <th className="right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearDividends.map(d => (
                        <tr key={d.id}>
                          <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{d.date}</td>
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{d.assetName}</td>
                          <td className="right mono">{fmt(d.grossAmount ?? 0)}</td>
                          <td className="right mono" style={{ color: (d.taxAmount ?? 0) > 0 ? 'var(--red)' : undefined }}>
                            {(d.taxAmount ?? 0) > 0 ? fmt(d.taxAmount) : '—'}
                          </td>
                          <td className="right mono" style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 600 }}>
                        <td colSpan={2}>Total</td>
                        <td className="right mono">{fmt(period.dividendGross)}</td>
                        <td className="right mono" style={{ color: 'var(--red)' }}>{fmt(period.dividendTax)}</td>
                        <td className="right mono" style={{ color: 'var(--green)' }}>{fmt(period.dividendNet)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            )}

            {/* ── Realised gains/losses ── */}
            {realisedSells.length > 0 && (
              <Card variant="section">
                <SectionHeader title={<><Icon name="swap" size={15} /> Realised Gains & Losses — {year}</>} />

                <div className="perf-table-wrap">
                  <table className="perf-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Asset</th>
                        <th className="right">Units</th>
                        <th className="right">Proceeds</th>
                        <th className="right">Cost Basis</th>
                        <th className="right">Gain/Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realisedSells.map((s, i) => {
                        const isPos = s.gainLoss >= 0;
                        return (
                          <tr key={s.tx.id || i}>
                            <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{s.tx.date}</td>
                            <td style={{ fontWeight: 500, fontSize: 13 }}>{s.assetName}</td>
                            <td className="right mono">{(s.tx.units ?? 0).toLocaleString('en-NZ', { maximumFractionDigits: 4 })}</td>
                            <td className="right mono">{fmt(s.proceeds)}</td>
                            <td className="right mono" style={{ color: 'var(--text2)' }}>{fmt(s.costBasis)}</td>
                            <td className="right mono" style={{ color: isPos ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              {isPos ? '+' : '−'}{fmt(s.gainLoss)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 600 }}>
                        <td colSpan={5}>Total</td>
                        <td className="right mono" style={{
                          color: period.realisedGL >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          {period.realisedGL >= 0 ? '+' : '−'}{fmt(period.realisedGL)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            )}

            {/* ── Cash flow summary ── */}
            {cashFlow.length > 0 && (
              <Card variant="section">
                <SectionHeader title={<><Icon name="wallet" size={15} /> Cash Flow — {year}</>} />

                <div className="tax-breakdown">
                  {cashFlow.map(c => (
                    <div key={c.type} className="tb-row">
                      <span>{c.label} <span style={{ color: 'var(--text3)', fontSize: 10, marginLeft: 4 }}>×{c.count}</span></span>
                      <span className="mono">{fmt(c.total)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Fee detail ── */}
            {yearFees.length > 0 && (
              <Card variant="section">
                <SectionHeader title={<><Icon name="tag" size={15} /> Fees — {year}</>} />

                <div className="fn-list">
                  {yearFees.map(f => (
                    <div key={f.id} className="fn-row">
                      <div className="fn-main" style={{ cursor: 'default' }}>
                        <div className="fn-left">
                          <div className="fn-dates">
                            <span className="fn-label">{f.assetName}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 4 }}>{f.date}</span>
                          </div>
                        </div>
                        <div className="fn-right">
                          <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)' }}>{fmt(f.amount)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ── Disclaimer ── */}
            <div className="report-disclaimer">
              This is a personal record of investment activity as entered by you.
              Amounts shown are as recorded and have not been independently verified.
              This is not tax advice — consult a qualified tax professional regarding
              FIF obligations, PIE tax credits, RWT reconciliation, or other tax matters.
            </div>
          </>
        )}

      </div>{/* end year-content */}
    </div>
  );
}
