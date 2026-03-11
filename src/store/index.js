/**
 * Central re-export for all domain stores.
 *
 * Import individual stores directly for the most targeted subscriptions:
 *
 *   import { useFinanceStore }    from './store';
 *   import { usePeopleStore }     from './store';
 *   import { usePropertyStore }   from './store';
 *   import { useInvestmentStore } from './store';
 *   import { useUiStore }         from './store';
 *
 * Or import from the top-level store.jsx compatibility bridge if you need the
 * legacy useApp() / AppProvider interface.
 */
export { useFinanceStore,    FINANCE_KEYS }    from './financeStore';
export { usePeopleStore,     PEOPLE_KEYS }     from './peopleStore';
export { usePropertyStore,   PROPERTY_KEYS }   from './propertyStore';
export { useInvestmentStore, INVESTMENT_KEYS } from './investmentStore';
export { useUiStore }                          from './uiStore';
