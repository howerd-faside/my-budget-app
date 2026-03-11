/**
 * Domain hooks — thin wrappers over the Zustand domain stores with stable,
 * named APIs.
 *
 * Usage:
 *   import { useFinance }    from '../store/hooks';
 *   import { usePeople }     from '../store/hooks';
 *   import { useProperty }   from '../store/hooks';
 *   import { useInvestment } from '../store/hooks';
 *   import { useUI }         from '../store/hooks';
 */
export { useFinance }    from './useFinance';
export { usePeople }     from './usePeople';
export { useProperty }   from './useProperty';
export { useInvestment } from './useInvestment';
export { useUI }         from './useUI';
