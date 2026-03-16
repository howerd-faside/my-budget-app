import { useMemo, useCallback } from 'react';
import {
  useHouseholdSnapshot,
  useSavingsPosition,
  useCashflowTrend,
  useObligationsSnapshot,
  usePortfolioAnalytics,
  useInvestment,
  usePeople,
  useWishlistSummary,
  useGoalsSummary,
  usePropertyAlerts,
  useNetWorth,
  useUpcomingObligations,
} from '../store/hooks';
import { fmtMoney, fmtMoneyRound } from '../utils/finance/tax';
import { fmtCurrency, fmtPct } from '../utils/format';

import HomeNetWorth from './home/HomeNetWorth';
import HomeHousehold from './home/HomeHousehold';
import HomeCashflowTrend from './home/HomeCashflowTrend';
import HomeMortgage from './home/HomeMortgage';
import HomePortfolio from './home/HomePortfolio';
import HomeWishlist from './home/HomeWishlist';
import HomeGoals from './home/HomeGoals';
import HomeAlerts from './home/HomeAlerts';
import HomeQuickActions from './home/HomeQuickActions';
import PortfolioStrip from '../components/investments/PortfolioStrip';

// ── Home ──────────────────────────────────────────────────────────────────────
export default function Home({ navigateTo }) {
  // ── People (for data-presence flags) ────────────────────────────────────
  const { people } = usePeople();
  const hasPeople = (people || []).length > 0;

  // ── Household snapshot ────────────────────────────────────────────────────
  const snap = useHouseholdSnapshot();

  // ── Savings position ──────────────────────────────────────────────────────
  const savings = useSavingsPosition();
  const thisYear = new Date().getFullYear();

  // ── Cashflow trend ────────────────────────────────────────────────────────
  const trend = useCashflowTrend();

  // ── Obligations ───────────────────────────────────────────────────────────
  const obligations = useObligationsSnapshot();

  // ── Investments ───────────────────────────────────────────────────────────
  const { investmentPortfolios } = useInvestment();
  const { overview, assets } = usePortfolioAnalytics();
  const hasInvestments = (investmentPortfolios || []).length > 0 && assets.length > 0;

  // ── Wishlist ──────────────────────────────────────────────────────────────
  const wl = useWishlistSummary();

  // ── Goals ─────────────────────────────────────────────────────────────────
  const goalsSummary = useGoalsSummary();

  // ── Property alerts ─────────────────────────────────────────────────────
  const propAlerts = usePropertyAlerts();

  // ── Net worth ───────────────────────────────────────────────────────────
  const nw = useNetWorth();

  // ── Upcoming obligations ────────────────────────────────────────────────
  const upcoming = useUpcomingObligations();

  // ── Merged alert items (property + obligations) ─────────────────────────
  const alertItems = useMemo(
    () => [...propAlerts.items, ...upcoming.items],
    [propAlerts.items, upcoming.items],
  );

  // ── Data-presence flag for quiet-zero alerts ────────────────────────────
  const hasAnyData = hasPeople || propAlerts.hasProperties || hasInvestments || obligations.hasLoans;

  const goalsForDisplay = useMemo(() =>
    goalsSummary.goals.map(g => ({
      id:          g.id,
      name:        g.name,
      target:      fmtMoneyRound(g.amount),
      progressPct: g.progressPct,
      eta:         g.hitDate || null,
    })),
    [goalsSummary.goals],
  );

  // ── Navigation callbacks ────────────────────────────────────────────────
  const go = useCallback(
    (section, tab) => navigateTo && navigateTo(section, tab),
    [navigateTo],
  );
  const goIncome      = useCallback(() => go('finances', 'income'),         [go]);
  const goOverview    = useCallback(() => go('finances', 'overview'),       [go]);
  const goMortgage    = useCallback(() => go('finances', 'mortgage'),       [go]);
  const goWishlist    = useCallback(() => go('finances', 'wishlist'),       [go]);
  const goInvDash     = useCallback(() => go('investments', 'inv-dashboard'),   [go]);
  const goInvManage   = useCallback(() => go('investments', 'inv-manage'),     [go]);

  return (
    <div className="page-content home-compact">

      {/* 1–2. Quick Actions then Alerts (stacked) */}
      <HomeQuickActions navigateTo={navigateTo} hasProperties={propAlerts.hasProperties} />
      <HomeAlerts items={alertItems} hasAnyData={hasAnyData} />

      {/* 3. Net Worth */}
      <HomeNetWorth
        netWorth={fmtCurrency(nw.netWorth)}
        cash={fmtCurrency(nw.cash)}
        investments={hasInvestments ? fmtCurrency(nw.investments) : null}
        property={nw.property > 0 ? fmtCurrency(nw.property) : null}
        liabilities={nw.liabilities > 0 ? fmtCurrency(nw.liabilities) : null}
        hasData={nw.hasData}
        netPositive={nw.netWorth >= 0}
      />

      {/* 4. Household Health then Loan Obligations (stacked) */}
      <HomeHousehold
        currentBalance={fmtMoney(savings.currentBalance)}
        netIncome={fmtMoney(snap.netIncome)}
        totalSpend={fmtMoney(snap.totalSpend)}
        savingsRate={`${Math.round(snap.savingsRate * 100)}%`}
        cashflowPositive={snap.netCashflow >= 0}
        projectedBalance={fmtMoney(savings.yearEndBalance)}
        projectedLabel={`Projected ${thisYear}`}
        hasPeople={hasPeople}
        onSetup={navigateTo && goIncome}
        onNavigate={navigateTo && goOverview}
      />
      <HomeMortgage
        totalBalance={fmtMoney(obligations.totalBalance)}
        repaymentFn={fmtMoney(obligations.repaymentFn)}
        payoffYear={obligations.payoffYear != null ? String(obligations.payoffYear) : '\u2014'}
        hasLoans={obligations.hasLoans}
        onNavigate={navigateTo && goMortgage}
      />

      {/* 5. Cashflow Trend then Investments (stacked) */}
      <HomeCashflowTrend points={trend.points} hasData={trend.hasData} />

      {/* 6. Wishlist */}
      <HomeWishlist
        pendingCount={wl.pendingCount}
        totalPendingCost={fmtMoneyRound(wl.totalPendingCost)}
        affordableNow={wl.affordableNow}
        nextAffordable={wl.nextAffordable}
        hasWishlist={wl.hasWishlist}
        onNavigate={navigateTo && goWishlist}
      />

      {/* 7. Portfolio selector + Investments */}
      <PortfolioStrip onManage={goInvManage} />
      <HomePortfolio
        totalValue={fmtCurrency(overview.totalValue)}
        totalGain={`${overview.unrealisedGL >= 0 ? '+' : '\u2212'}${fmtCurrency(Math.abs(overview.unrealisedGL))}`}
        gainPositive={overview.unrealisedGL >= 0}
        returnPct={overview.totalCost > 0 ? fmtPct((overview.unrealisedGL / overview.totalCost) * 100) : '\u2014'}
        hasData={hasInvestments}
        onNavigate={navigateTo && goInvDash}
      />

      {/* 8. Goals */}
      <HomeGoals
        goals={goalsForDisplay}
        hasGoals={goalsSummary.hasGoals}
        onNavigate={navigateTo && goOverview}
      />

    </div>
  );
}
