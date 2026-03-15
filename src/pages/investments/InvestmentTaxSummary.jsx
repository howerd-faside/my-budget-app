import { useState, useMemo } from 'react';
import { usePortfolioAnalytics } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, EmptyState, Card } from '../../components/ui';
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

  // Dividends grouped by asset
  const dividendsByAsset = useMemo(() => {
    const groups = {};
    for (const d of yearDividends) {
      const key = d.assetId || '_none';
      if (!groups[key]) groups[key] = { assetName: d.assetName, gross: 0, tax: 0, net: 0, count: 0 };
      groups[key].gross += d.grossAmount ?? 0;
      groups[key].tax   += d.taxAmount   ?? 0;
      groups[key].net   += d.amount;
      groups[key].count += 1;
    }
    return Object.values(groups).sort((a, b) => b.net - a.net);
  }, [yearDividends]);

  // Year's fees for the detail list
  const yearFees = useMemo(() => {
    const nameMap = {};
    for (const a of assets) nameMap[a.id] = a.name;
    return yearTxs
      .filter(tx => tx.type === 'fee')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(tx => ({ ...tx, assetName: nameMap[tx.assetId] || tx.label || 'Fee' }));
  }, [yearTxs, assets]);

  // Cash flow counts for the annual summary
  const cashFlowCounts = useMemo(() => {
    const counts = {};
    for (const tx of yearTxs) {
      counts[tx.type] = (counts[tx.type] || 0) + 1;
    }
    return counts;
  }, [yearTxs]);

  const hasData = yearTxs.length > 0;

  // ── CSV export ──────────────────────────────────────────────────────────────

  const handleExport = () => {
    const rows = [];

    // Annual summary section
    rows.push(['--- Annual Summary ---', '', '']);
    rows.push(['Metric', 'Value', '']);
    rows.push(['Year', yearStr, '']);
    rows.push(['Total Transactions', String(yearTxs.length), '']);
    rows.push(['Amount Invested', period.invested.toFixed(2), '']);
    rows.push(['Amount Disposed', period.disposed.toFixed(2), '']);
    rows.push(['Realised Gain/Loss', period.realisedGL.toFixed(2), '']);
    rows.push(['Dividend Income (Gross)', period.dividendGross.toFixed(2), '']);
    rows.push(['Tax Withheld (RWT)', period.dividendTax.toFixed(2), '']);
    rows.push(['Dividend Income (Net)', period.dividendNet.toFixed(2), '']);
    if (period.feesPaid > 0) rows.push(['Fees Paid', period.feesPaid.toFixed(2), '']);
    rows.push([]);

    // Dividends section
    if (yearDividends.length > 0) {
      rows.push(['--- Dividends ---', '', '', '', '']);
      rows.push(['Date', 'Asset', 'Gross', 'Tax Withheld', 'Net']);
      for (const d of yearDividends) {
        rows.push([d.date, d.assetName, (d.grossAmount ?? 0).toFixed(2), (d.taxAmount ?? 0).toFixed(2), d.amount.toFixed(2)]);
      }
      rows.push(['', 'Total', period.dividendGross.toFixed(2), period.dividendTax.toFixed(2), period.dividendNet.toFixed(2)]);
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

    // Fees section
    if (yearFees.length > 0) {
      rows.push(['--- Fees ---', '', '']);
      rows.push(['Date', 'Description', 'Amount']);
      for (const f of yearFees) {
        rows.push([f.date, f.assetName, f.amount.toFixed(2)]);
      }
      rows.push(['', 'Total', period.feesPaid.toFixed(2)]);
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
            title={`No activity for ${year}.`}
          />
        ) : (
          <>
            {/* ── Annual Summary ── */}
            <Card variant="section">
              <SectionHeader
                title={<><Icon name="clipboard" size={15} /> Annual Summary — {year}</>}
                actions={
                  <button className="btn-ghost small" onClick={handleExport}>
                    Export CSV
                  </button>
                }
              />

              <div className="dash-grid" style={{ gap: 12 }}>
                {/* Capital Activity column */}
                <div className="dash-col-4" style={{ minWidth: 0 }}>
                  <div className="tb-section-label">Capital Activity</div>
                  <div className="tax-breakdown">
                    <div className="tb-row">
                      <span>Invested {cashFlowCounts.buy > 0 && <span style={{ color: 'var(--text3)', fontSize: 10 }}>{cashFlowCounts.buy} buys</span>}</span>
                      <span className="mono">{fmt(period.invested)}</span>
                    </div>
                    <div className="tb-row">
                      <span>Disposed {cashFlowCounts.sell > 0 && <span style={{ color: 'var(--text3)', fontSize: 10 }}>{cashFlowCounts.sell} sells</span>}</span>
                      <span className="mono">{fmt(period.disposed)}</span>
                    </div>
                    <div className="tb-divider" />
                    <div className="tb-row bold">
                      <span>Realised G/L</span>
                      <span className="mono" style={{ color: period.realisedGL >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {period.realisedGL >= 0 ? '+' : '−'}{fmt(period.realisedGL)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dividend Income column */}
                <div className="dash-col-4" style={{ minWidth: 0 }}>
                  <div className="tb-section-label">Dividend Income</div>
                  <div className="tax-breakdown">
                    <div className="tb-row">
                      <span>Gross dividends {cashFlowCounts.dividend > 0 && <span style={{ color: 'var(--text3)', fontSize: 10 }}>{cashFlowCounts.dividend} payments</span>}</span>
                      <span className="mono">{fmt(period.dividendGross)}</span>
                    </div>
                    <div className="tb-row red">
                      <span>Tax withheld (RWT)</span>
                      <span className="mono">{fmt(period.dividendTax)}</span>
                    </div>
                    <div className="tb-divider" />
                    <div className="tb-row bold green">
                      <span>Net received</span>
                      <span className="mono">{fmt(period.dividendNet)}</span>
                    </div>
                  </div>
                </div>

                {/* Totals column */}
                <div className="dash-col-4" style={{ minWidth: 0 }}>
                  <div className="tb-section-label">Period Totals</div>
                  <div className="tax-breakdown">
                    <div className="tb-row">
                      <span>Transactions</span>
                      <span className="mono">{yearTxs.length}</span>
                    </div>
                    {(cashFlowCounts.deposit || 0) > 0 && (
                      <div className="tb-row">
                        <span>Deposits</span>
                        <span className="mono">{fmt(yearTxs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0))}</span>
                      </div>
                    )}
                    {(cashFlowCounts.withdrawal || 0) > 0 && (
                      <div className="tb-row">
                        <span>Withdrawals</span>
                        <span className="mono">{fmt(yearTxs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0))}</span>
                      </div>
                    )}
                    {period.feesPaid > 0 && (
                      <div className="tb-row red">
                        <span>Fees paid</span>
                        <span className="mono">{fmt(period.feesPaid)}</span>
                      </div>
                    )}
                    <div className="tb-divider" />
                    <div className="tb-row bold">
                      <span>Net position change</span>
                      <span className="mono" style={{
                        color: (period.dividendNet + period.realisedGL - period.feesPaid) >= 0 ? 'var(--green)' : 'var(--red)',
                      }}>
                        {(period.dividendNet + period.realisedGL - period.feesPaid) >= 0 ? '+' : '−'}
                        {fmt(period.dividendNet + period.realisedGL - period.feesPaid)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Dividend report ── */}
            {yearDividends.length > 0 && (
              <Card variant="section">
                <SectionHeader title={<><Icon name="arrow-down" size={15} /> Dividend Report — {year}</>} />

                {/* By-asset summary */}
                {dividendsByAsset.length > 1 && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="perf-table-wrap">
                      <table className="perf-table">
                        <thead>
                          <tr>
                            <th>Asset</th>
                            <th className="right">Payments</th>
                            <th className="right">Gross</th>
                            <th className="right">Tax</th>
                            <th className="right">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dividendsByAsset.map(g => (
                            <tr key={g.assetName}>
                              <td style={{ fontWeight: 500, fontSize: 13 }}>{g.assetName}</td>
                              <td className="right mono">{g.count}</td>
                              <td className="right mono">{fmt(g.gross)}</td>
                              <td className="right mono" style={{ color: g.tax > 0 ? 'var(--red)' : undefined }}>
                                {g.tax > 0 ? fmt(g.tax) : '—'}
                              </td>
                              <td className="right mono" style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(g.net)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 600 }}>
                            <td>Total</td>
                            <td className="right mono">{yearDividends.length}</td>
                            <td className="right mono">{fmt(period.dividendGross)}</td>
                            <td className="right mono" style={{ color: 'var(--red)' }}>{fmt(period.dividendTax)}</td>
                            <td className="right mono" style={{ color: 'var(--green)' }}>{fmt(period.dividendNet)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Per-transaction detail */}
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

            {/* ── Fee detail ── */}
            {yearFees.length > 0 && (
              <Card variant="section">
                <SectionHeader title={<><Icon name="tag" size={15} /> Fees — {year}</>} />

                <div className="perf-table-wrap">
                  <table className="perf-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th className="right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearFees.map(f => (
                        <tr key={f.id}>
                          <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{f.date}</td>
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{f.assetName}</td>
                          <td className="right mono" style={{ color: 'var(--red)', fontWeight: 600 }}>{fmt(f.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 600 }}>
                        <td colSpan={2}>Total</td>
                        <td className="right mono" style={{ color: 'var(--red)' }}>{fmt(period.feesPaid)}</td>
                      </tr>
                    </tfoot>
                  </table>
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
