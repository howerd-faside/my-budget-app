/**
 * Central re-export for all domain stores and domain hooks.
 *
 * Prefer domain hooks for component usage:
 *
 *   import { useFinance }    from './store/hooks';
 *   import { usePeople }     from './store/hooks';
 *   import { useProperty }   from './store/hooks';
 *   import { useInvestment } from './store/hooks';
 *   import { useUI }         from './store/hooks';
 *
 * Import raw stores for direct/low-level access (tests, utilities):
 *
 *   import { useFinanceStore }    from './store';
 *   import { usePeopleStore }     from './store';
 *   import { usePropertyStore }   from './store';
 *   import { useInvestmentStore } from './store';
 *   import { useUiStore }         from './store';
 *
 */

// Raw domain stores
export { useFinanceStore,    FINANCE_KEYS }    from './financeStore';
export { usePeopleStore,     PEOPLE_KEYS }     from './peopleStore';
export { usePropertyStore,   PROPERTY_KEYS }   from './propertyStore';
export { useInvestmentStore, INVESTMENT_KEYS } from './investmentStore';
export { useUiStore }                          from './uiStore';

// Domain hooks (preferred for component consumption)
export { useFinance, usePeople, useProperty, useInvestment, useUI } from './hooks';
