import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { useInvestment } from './useInvestment';
import { useProperty } from './useProperty';
import { useMortgageFacilities } from './useMortgageFacilities';
import { totalBalance } from '../../utils/finance/savings';
import { calcPortfolioOverview } from '../../utils/finance/portfolio';

export interface NetWorth {
  cash:        number;
  investments: number;
  property:    number;
  liabilities: number;
  netWorth:    number;
  hasData:     boolean;
}

/**
 * Derived hook — household net worth across all domains.
 *
 * Assets:
 *   cash        — totalBalance(accounts)
 *   investments — calcPortfolioOverview across ALL portfolios (not just selected)
 *   property    — sum of valuation.estimatedValue where present
 *
 * Liabilities:
 *   liabilities — sum of qualifying loan facility balances
 *
 * netWorth = cash + investments + property − liabilities
 */
export function useNetWorth(): NetWorth {
  const { accounts }                                            = useFinance();
  const { investmentAssets, investmentTransactions, priceCache } = useInvestment();
  const { properties }                                          = useProperty();
  const { facilities }                                          = useMortgageFacilities();

  return useMemo(() => {
    const cash = totalBalance(accounts);

    // Investments — all portfolios, not filtered to selected
    const allAssets = investmentAssets || [];
    const allTxns   = investmentTransactions || [];
    const allPrices = priceCache || [];
    let investments = 0;
    if (allAssets.length > 0) {
      investments = calcPortfolioOverview(allAssets, allTxns, allPrices).totalValue;
    }

    // Property valuations — use the latest entry from each property's valuations array
    const property = (properties || []).reduce((sum, p) => {
      const vals = p.valuations || [];
      if (vals.length === 0) return sum;
      const latest = vals.reduce((a, b) =>
        (a.valuationDate || a.createdAt || '') >= (b.valuationDate || b.createdAt || '') ? a : b
      );
      const v = latest.estimatedValue;
      return sum + (typeof v === 'number' && v > 0 ? v : 0);
    }, 0);

    // Outstanding loan balances
    const liabilities = facilities.reduce((sum, f) => sum + (+f.balance || 0), 0);

    const netWorth = cash + investments + property - liabilities;
    const hasData  = cash > 0 || investments > 0 || property > 0 || liabilities > 0;

    return { cash, investments, property, liabilities, netWorth, hasData };
  }, [accounts, investmentAssets, investmentTransactions, priceCache, properties, facilities]);
}
