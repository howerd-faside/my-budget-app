/**
 * Transaction adoption equivalence tests.
 *
 * Proves that refactoring component stats calculations to use Transaction
 * adapters + shared helpers produces identical results to the pre-refactor
 * direct-reduce patterns.
 *
 * Covers:
 *   - InvestmentContributions stats (total, thisYear, thisMonth)
 *   - InvestmentDividends stats (totalGross, totalTax, totalNet)
 *   - InvestmentTaxSummary summary (all totals + contribByType)
 *   - Cross-domain aggregation (mixed contribution + dividend transaction sets)
 *   - Filter consistency (filterByYear vs filterByDateRange for full-year spans)
 *   - Filter consistency (filterByYearMonth vs filterByDateRange for full-month spans)
 */
import { describe, it, expect } from 'vitest';
import {
  transactionFromContribution,
  transactionFromDividend,
} from '../../models/Transaction';
import {
  filterByYear,
  filterByYearMonth,
  filterByDateRange,
  sumTransactions,
  sumField,
  groupSumByCategory,
} from '../../utils/finance/transactions';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const contributions = [
  { id: 'c1', portfolioId: 'p1', date: '2025-11-01', amount: 300,  type: 'Regular'   },
  { id: 'c2', portfolioId: 'p1', date: '2026-01-15', amount: 500,  type: 'Regular'   },
  { id: 'c3', portfolioId: 'p1', date: '2026-03-01', amount: 200,  type: 'Lump Sum'  },
  { id: 'c4', portfolioId: 'p1', date: '2026-03-20', amount: 150,  type: 'KiwiSaver' },
  { id: 'c5', portfolioId: 'p2', date: '2026-02-10', amount: 1000, type: 'Regular'   },
];

const dividends = [
  { id: 'd1', portfolioId: 'p1', date: '2025-12-15', grossAmount:  80, taxAmount: 26.4, netAmount:  53.6 },
  { id: 'd2', portfolioId: 'p1', date: '2026-01-20', grossAmount: 100, taxAmount: 33,   netAmount:  67   },
  { id: 'd3', portfolioId: 'p1', date: '2026-03-10', grossAmount:  50, taxAmount: 16.5, netAmount:  33.5 },
  { id: 'd4', portfolioId: 'p2', date: '2026-02-28', grossAmount: 200, taxAmount: 66,   netAmount: 134   },
];

// ── InvestmentContributions stats ─────────────────────────────────────────────

describe('InvestmentContributions stats — pre vs post refactor equivalence', () => {
  const p1Contribs = contributions.filter(c => c.portfolioId === 'p1');

  function preRefactorStats(contribs, thisYear, thisMonth) {
    return {
      total:     contribs.reduce((s, c) => s + (+c.amount || 0), 0),
      thisYear:  contribs.filter(c => c.date?.startsWith(thisYear)).reduce((s, c) => s + (+c.amount || 0), 0),
      thisMonth: contribs.filter(c => c.date?.startsWith(thisMonth)).reduce((s, c) => s + (+c.amount || 0), 0),
    };
  }

  function postRefactorStats(contribs, thisYear, thisMonth) {
    const txs = contribs.map(transactionFromContribution);
    return {
      total:     sumTransactions(txs),
      thisYear:  sumTransactions(filterByYear(txs, thisYear)),
      thisMonth: sumTransactions(filterByYearMonth(txs, thisMonth)),
    };
  }

  it('total matches', () => {
    const pre  = preRefactorStats(p1Contribs, '2026', '2026-03');
    const post = postRefactorStats(p1Contribs, '2026', '2026-03');
    expect(post.total).toBeCloseTo(pre.total, 4);
  });

  it('thisYear matches for 2026', () => {
    const pre  = preRefactorStats(p1Contribs, '2026', '2026-03');
    const post = postRefactorStats(p1Contribs, '2026', '2026-03');
    expect(post.thisYear).toBeCloseTo(pre.thisYear, 4);
  });

  it('thisMonth matches for 2026-03', () => {
    const pre  = preRefactorStats(p1Contribs, '2026', '2026-03');
    const post = postRefactorStats(p1Contribs, '2026', '2026-03');
    expect(post.thisMonth).toBeCloseTo(pre.thisMonth, 4);
  });

  it('year filter correctly excludes 2025 record (c1, $300)', () => {
    const txs  = p1Contribs.map(transactionFromContribution);
    const post = sumTransactions(filterByYear(txs, '2026'));
    // c1 (2025-11-01, $300) excluded; c2 + c3 + c4 = $850
    expect(post).toBeCloseTo(500 + 200 + 150, 4);
  });

  it('month filter returns only March 2026 contributions', () => {
    const txs  = p1Contribs.map(transactionFromContribution);
    const post = sumTransactions(filterByYearMonth(txs, '2026-03'));
    // c3 ($200) + c4 ($150) = $350
    expect(post).toBeCloseTo(200 + 150, 4);
  });

  it('returns zero totals for empty input', () => {
    const post = postRefactorStats([], '2026', '2026-03');
    expect(post.total).toBe(0);
    expect(post.thisYear).toBe(0);
    expect(post.thisMonth).toBe(0);
  });

  it('handles string-typed amounts (backwards compat)', () => {
    const strContribs = [
      { id: 'x1', portfolioId: 'p1', date: '2026-03-01', amount: '400', type: 'Regular' },
    ];
    const pre  = preRefactorStats(strContribs, '2026', '2026-03');
    const post = postRefactorStats(strContribs, '2026', '2026-03');
    expect(post.total).toBeCloseTo(pre.total, 4);
    expect(post.thisYear).toBeCloseTo(pre.thisYear, 4);
    expect(post.thisMonth).toBeCloseTo(pre.thisMonth, 4);
  });
});

// ── InvestmentDividends stats ─────────────────────────────────────────────────

describe('InvestmentDividends stats — pre vs post refactor equivalence', () => {
  const p1Divs = dividends.filter(d => d.portfolioId === 'p1');

  function preRefactorStats(divs) {
    return {
      totalGross: divs.reduce((s, d) => s + (+d.grossAmount || 0), 0),
      totalTax:   divs.reduce((s, d) => s + (+d.taxAmount   || 0), 0),
      totalNet:   divs.reduce((s, d) => s + (+d.netAmount   || 0), 0),
    };
  }

  function postRefactorStats(divs) {
    const txs = divs.map(transactionFromDividend);
    return {
      totalGross: sumField(txs, 'grossAmount'),
      totalTax:   sumField(txs, 'taxAmount'),
      totalNet:   sumTransactions(txs),
    };
  }

  it('totalGross matches', () => {
    const pre  = preRefactorStats(p1Divs);
    const post = postRefactorStats(p1Divs);
    expect(post.totalGross).toBeCloseTo(pre.totalGross, 4);
  });

  it('totalTax matches', () => {
    const pre  = preRefactorStats(p1Divs);
    const post = postRefactorStats(p1Divs);
    expect(post.totalTax).toBeCloseTo(pre.totalTax, 4);
  });

  it('totalNet matches', () => {
    const pre  = preRefactorStats(p1Divs);
    const post = postRefactorStats(p1Divs);
    expect(post.totalNet).toBeCloseTo(pre.totalNet, 4);
  });

  it('totalNet = totalGross − totalTax (self-consistent)', () => {
    const post = postRefactorStats(p1Divs);
    expect(post.totalNet).toBeCloseTo(post.totalGross - post.totalTax, 4);
  });

  it('returns zero for empty array', () => {
    const post = postRefactorStats([]);
    expect(post.totalGross).toBe(0);
    expect(post.totalTax).toBe(0);
    expect(post.totalNet).toBe(0);
  });

  it('handles string-typed amounts (backwards compat)', () => {
    const strDivs = [{
      id: 's1', portfolioId: 'p1', date: '2026-01-01',
      grossAmount: '120', taxAmount: '39.6', netAmount: '80.4',
    }];
    const pre  = preRefactorStats(strDivs);
    const post = postRefactorStats(strDivs);
    expect(post.totalGross).toBeCloseTo(pre.totalGross, 4);
    expect(post.totalTax).toBeCloseTo(pre.totalTax, 4);
    expect(post.totalNet).toBeCloseTo(pre.totalNet, 4);
  });
});

// ── InvestmentTaxSummary summary ──────────────────────────────────────────────

describe('InvestmentTaxSummary summary — pre vs post refactor equivalence', () => {
  const p1Contribs = contributions.filter(c => c.portfolioId === 'p1');
  const p1Divs     = dividends.filter(d => d.portfolioId === 'p1');
  const yearStr    = '2026';

  function preRefactorSummary(contribs, divs, yr) {
    const yearContribs  = contribs.filter(c => c.date?.startsWith(yr));
    const yearDivs      = divs.filter(d => d.date?.startsWith(yr));
    const totalContrib  = yearContribs.reduce((s, c) => s + (+c.amount     || 0), 0);
    const totalDivGross = yearDivs.reduce((s, d)     => s + (+d.grossAmount || 0), 0);
    const totalDivTax   = yearDivs.reduce((s, d)     => s + (+d.taxAmount   || 0), 0);
    const totalDivNet   = yearDivs.reduce((s, d)     => s + (+d.netAmount   || 0), 0);
    const contribByType = {};
    for (const c of yearContribs) {
      contribByType[c.type || 'Other'] = (contribByType[c.type || 'Other'] || 0) + (+c.amount || 0);
    }
    return { totalContrib, totalDivGross, totalDivTax, totalDivNet, contribByType };
  }

  function postRefactorSummary(contribs, divs, yr) {
    const yearContribTxs = filterByYear(contribs.map(transactionFromContribution), yr);
    const yearDivTxs     = filterByYear(divs.map(transactionFromDividend), yr);
    return {
      totalContrib:  sumTransactions(yearContribTxs),
      totalDivGross: sumField(yearDivTxs, 'grossAmount'),
      totalDivTax:   sumField(yearDivTxs, 'taxAmount'),
      totalDivNet:   sumTransactions(yearDivTxs),
      contribByType: groupSumByCategory(yearContribTxs),
    };
  }

  it('totalContrib matches', () => {
    const pre  = preRefactorSummary(p1Contribs, p1Divs, yearStr);
    const post = postRefactorSummary(p1Contribs, p1Divs, yearStr);
    expect(post.totalContrib).toBeCloseTo(pre.totalContrib, 4);
  });

  it('totalDivGross matches', () => {
    const pre  = preRefactorSummary(p1Contribs, p1Divs, yearStr);
    const post = postRefactorSummary(p1Contribs, p1Divs, yearStr);
    expect(post.totalDivGross).toBeCloseTo(pre.totalDivGross, 4);
  });

  it('totalDivTax matches', () => {
    const pre  = preRefactorSummary(p1Contribs, p1Divs, yearStr);
    const post = postRefactorSummary(p1Contribs, p1Divs, yearStr);
    expect(post.totalDivTax).toBeCloseTo(pre.totalDivTax, 4);
  });

  it('totalDivNet matches', () => {
    const pre  = preRefactorSummary(p1Contribs, p1Divs, yearStr);
    const post = postRefactorSummary(p1Contribs, p1Divs, yearStr);
    expect(post.totalDivNet).toBeCloseTo(pre.totalDivNet, 4);
  });

  it('contribByType keys match', () => {
    const pre  = preRefactorSummary(p1Contribs, p1Divs, yearStr);
    const post = postRefactorSummary(p1Contribs, p1Divs, yearStr);
    expect(Object.keys(post.contribByType).sort()).toEqual(Object.keys(pre.contribByType).sort());
  });

  it('contribByType values match for each key', () => {
    const pre  = preRefactorSummary(p1Contribs, p1Divs, yearStr);
    const post = postRefactorSummary(p1Contribs, p1Divs, yearStr);
    for (const key of Object.keys(pre.contribByType)) {
      expect(post.contribByType[key]).toBeCloseTo(pre.contribByType[key], 4);
    }
  });

  it('year filter excludes 2025 records (c1=$300, d1=gross$80)', () => {
    const post = postRefactorSummary(p1Contribs, p1Divs, yearStr);
    // 2026 contributions: c2($500) + c3($200) + c4($150) = $850
    expect(post.totalContrib).toBeCloseTo(500 + 200 + 150, 4);
    // 2026 dividends: d2(gross$100) + d3(gross$50) = $150
    expect(post.totalDivGross).toBeCloseTo(100 + 50, 4);
  });

  it('returns zero totals for a year with no data', () => {
    const post = postRefactorSummary(p1Contribs, p1Divs, '2030');
    expect(post.totalContrib).toBe(0);
    expect(post.totalDivGross).toBe(0);
    expect(post.totalDivTax).toBe(0);
    expect(post.totalDivNet).toBe(0);
    expect(Object.keys(post.contribByType)).toHaveLength(0);
  });

  it('null/undefined type groups under "Other" consistently', () => {
    const noTypeContribs = [
      { id: 'n1', portfolioId: 'p1', date: '2026-01-01', amount: 100, type: undefined },
      { id: 'n2', portfolioId: 'p1', date: '2026-02-01', amount: 200, type: ''        },
    ];
    const pre  = preRefactorSummary(noTypeContribs, [], yearStr);
    const post = postRefactorSummary(noTypeContribs, [], yearStr);
    expect(post.contribByType['Other']).toBeCloseTo(pre.contribByType['Other'], 4);
  });
});

// ── Cross-domain aggregation ──────────────────────────────────────────────────

describe('Cross-domain aggregation — mixed transaction sets', () => {
  it('sumTransactions handles mixed contribution + dividend Transactions', () => {
    const contribTxs = contributions.map(transactionFromContribution);
    const divTxs     = dividends.map(transactionFromDividend);
    const combined   = sumTransactions([...contribTxs, ...divTxs]);
    expect(combined).toBeCloseTo(
      sumTransactions(contribTxs) + sumTransactions(divTxs),
      4,
    );
  });

  it('filterByYear works consistently across contribution and dividend Transactions', () => {
    const contribTxs   = contributions.map(transactionFromContribution);
    const divTxs       = dividends.map(transactionFromDividend);
    const contrib2026  = filterByYear(contribTxs, '2026');
    const div2026      = filterByYear(divTxs, '2026');
    expect(contrib2026.every(tx => tx.date?.startsWith('2026'))).toBe(true);
    expect(div2026.every(tx => tx.date?.startsWith('2026'))).toBe(true);
    expect(contrib2026.some(tx => tx.date?.startsWith('2025'))).toBe(false);
    expect(div2026.some(tx => tx.date?.startsWith('2025'))).toBe(false);
  });

  it('portfolio isolation: p1 + p2 contribution sums equal the combined total', () => {
    const p1Txs  = contributions.filter(c => c.portfolioId === 'p1').map(transactionFromContribution);
    const p2Txs  = contributions.filter(c => c.portfolioId === 'p2').map(transactionFromContribution);
    const allTxs = contributions.map(transactionFromContribution);
    expect(sumTransactions(p1Txs) + sumTransactions(p2Txs))
      .toBeCloseTo(sumTransactions(allTxs), 4);
  });

  it('filterByDateRange on mixed domains includes only in-range items', () => {
    const contribTxs = contributions.map(transactionFromContribution);
    const divTxs     = dividends.map(transactionFromDividend);
    const inRange    = filterByDateRange([...contribTxs, ...divTxs], '2026-03-01', '2026-03-31');
    expect(inRange.every(tx => tx.date >= '2026-03-01' && tx.date <= '2026-03-31')).toBe(true);
    // c3, c4, d3 all fall in March 2026
    expect(inRange.map(tx => tx.id).sort()).toEqual(['c3', 'c4', 'd3'].sort());
  });
});

// ── Filter consistency — year vs date range ───────────────────────────────────

describe('Filter consistency — year vs date range', () => {
  const contribTxs = contributions.map(transactionFromContribution);

  it('filterByYear and filterByDateRange return the same records for a full year', () => {
    const byYear  = filterByYear(contribTxs, '2026');
    const byRange = filterByDateRange(contribTxs, '2026-01-01', '2026-12-31');
    expect(byYear.map(tx => tx.id).sort()).toEqual(byRange.map(tx => tx.id).sort());
  });

  it('filterByYearMonth and filterByDateRange return the same records for a full month', () => {
    const byMonth = filterByYearMonth(contribTxs, '2026-03');
    const byRange = filterByDateRange(contribTxs, '2026-03-01', '2026-03-31');
    expect(byMonth.map(tx => tx.id).sort()).toEqual(byRange.map(tx => tx.id).sort());
  });

  it('sumTransactions is consistent regardless of which filter is used for a full year', () => {
    const byYear  = sumTransactions(filterByYear(contribTxs, '2026'));
    const byRange = sumTransactions(filterByDateRange(contribTxs, '2026-01-01', '2026-12-31'));
    expect(byYear).toBeCloseTo(byRange, 4);
  });

  it('sumTransactions is consistent regardless of which filter is used for a full month', () => {
    const byMonth = sumTransactions(filterByYearMonth(contribTxs, '2026-03'));
    const byRange = sumTransactions(filterByDateRange(contribTxs, '2026-03-01', '2026-03-31'));
    expect(byMonth).toBeCloseTo(byRange, 4);
  });
});
