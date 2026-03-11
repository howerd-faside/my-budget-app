import { useState, useMemo } from 'react';
import { useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { transactionFromContribution, transactionFromDividend } from '../../models/Transaction';
import { filterByYear, sumTransactions, sumField, groupSumByCategory } from '../../utils/finance/transactions';

const fmt = (n) =>
  `$${Math.abs(+n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const YEAR_WINDOW = 7;
const THIS_YEAR   = new Date().getFullYear();

export default function InvestmentTaxSummary() {
  const { selectedPortfolioId: pid, investments, investmentContributions, investmentDividends } = useInvestment();
  const holdings      = (investments             || []).filter(h => h.portfolioId === pid);
  const contributions = (investmentContributions || []).filter(c => c.portfolioId === pid);
  const dividends     = (investmentDividends     || []).filter(d => d.portfolioId === pid);

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

  const yearStr = String(year);

  const summary = useMemo(() => {
    // Aggregate totals via Transaction adapters (canonical numeric coercion).
    const yearContribTxs = filterByYear(contributions.map(transactionFromContribution), yearStr);
    const yearDivTxs     = filterByYear(dividends.map(transactionFromDividend), yearStr);

    const totalContrib  = sumTransactions(yearContribTxs);
    const totalDivGross = sumField(yearDivTxs, 'grossAmount');
    const totalDivTax   = sumField(yearDivTxs, 'taxAmount');
    const totalDivNet   = sumTransactions(yearDivTxs);
    const contribByType = groupSumByCategory(yearContribTxs);

    // Keep domain records for rendering (template accesses raw fields).
    const yearContribs = contributions
      .filter(c => c.date?.startsWith(yearStr))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const yearDivs = dividends
      .filter(d => d.date?.startsWith(yearStr))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return {
      totalContrib, totalDivGross, totalDivTax, totalDivNet,
      contribByType,
      yearContribs,
      yearDivs,
    };
  }, [contributions, dividends, yearStr]);

  const hasData = summary.yearContribs.length > 0 || summary.yearDivs.length > 0;

  return (
    <div className="page-content">

      {/* ── Scrolling year bar (same as Finance › Tracking) ── */}
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
          <div className="empty-state">
            <div className="es-icon"><Icon name="clipboard" size={38} /></div>
            <div className="es-text">No investment activity recorded for {year}.</div>
          </div>
        ) : (
          <>
            {/* Summary tiles */}
            <div className="fn-summary">
              <div className="fns-item">
                <span>Contributions</span>
                <div className="fns-val-row"><span className="mono">{fmt(summary.totalContrib)}</span></div>
              </div>
              <div className="fns-item">
                <span>Dividend Income</span>
                <div className="fns-val-row"><span className="mono">{fmt(summary.totalDivGross)}</span></div>
              </div>
              <div className="fns-item">
                <span>Tax Withheld</span>
                <div className="fns-val-row">
                  <span className="mono" style={{ color: 'var(--red)' }}>{fmt(summary.totalDivTax)}</span>
                </div>
              </div>
              <div className="fns-item">
                <span>Net Dividends</span>
                <div className="fns-val-row">
                  <span className="mono" style={{ color: 'var(--green)' }}>{fmt(summary.totalDivNet)}</span>
                </div>
              </div>
            </div>

            {/* Contributions by type */}
            {summary.yearContribs.length > 0 && (
              <div className="dash-section">
                <div className="section-header"><h3>Contributions — {year}</h3></div>

                {Object.keys(summary.contribByType).length > 1 && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="tax-breakdown">
                      {Object.entries(summary.contribByType)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, amount]) => (
                          <div key={type} className="tb-row">
                            <span>{type}</span>
                            <span className="mono">{fmt(amount)}</span>
                          </div>
                        ))}
                      <div className="tb-divider" />
                      <div className="tb-row bold">
                        <span>Total</span>
                        <span className="mono">{fmt(summary.totalContrib)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="fn-list">
                  {summary.yearContribs.map(c => {
                    const holding = holdings.find(h => h.id === c.holdingId);
                    return (
                      <div key={c.id} className="fn-row">
                        <div className="fn-main" style={{ cursor: 'default' }}>
                          <div className="fn-left">
                            <div className="fn-dates">
                              <span className="fn-label">
                                {holding ? holding.name : (c.platform || 'Unlinked')}
                              </span>
                              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{c.date}</span>
                                <span className="dpill teal">{c.type}</span>
                              </div>
                            </div>
                          </div>
                          <div className="fn-right">
                            <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmt(c.amount)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dividends */}
            {summary.yearDivs.length > 0 && (
              <div className="dash-section">
                <div className="section-header"><h3>Dividends — {year}</h3></div>

                <div style={{ marginBottom: 16 }}>
                  <div className="tax-breakdown">
                    <div className="tb-row">
                      <span>Gross dividends</span>
                      <span className="mono">{fmt(summary.totalDivGross)}</span>
                    </div>
                    <div className="tb-row red">
                      <span>Tax withheld (RWT/NRWT)</span>
                      <span className="mono">{fmt(summary.totalDivTax)}</span>
                    </div>
                    <div className="tb-divider" />
                    <div className="tb-row bold green">
                      <span>Net dividends received</span>
                      <span className="mono">{fmt(summary.totalDivNet)}</span>
                    </div>
                  </div>
                </div>

                <div className="fn-list">
                  {summary.yearDivs.map(d => {
                    const holding = holdings.find(h => h.id === d.holdingId);
                    return (
                      <div key={d.id} className="fn-row">
                        <div className="fn-main" style={{ cursor: 'default' }}>
                          <div className="fn-left">
                            <div className="fn-dates">
                              <span className="fn-label">
                                {holding ? holding.name : (d.platform || 'Dividend')}
                              </span>
                              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{d.date}</span>
                                {d.taxAmount && +d.taxAmount > 0 && (
                                  <span className="dpill red">Tax {fmt(d.taxAmount)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="fn-right" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                            <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>
                              {fmt(d.netAmount || d.grossAmount)}
                            </span>
                            {d.grossAmount && d.netAmount && +d.grossAmount !== +d.netAmount && (
                              <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
                                gross {fmt(d.grossAmount)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
                  Note: This is a personal summary only. Consult a tax professional for advice on FIF rules,
                  portfolio investment entities, or overseas tax obligations.
                </div>
              </div>
            )}
          </>
        )}

      </div>{/* end year-content */}
    </div>
  );
}
