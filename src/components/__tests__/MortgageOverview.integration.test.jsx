// @vitest-environment jsdom
/**
 * Integration tests for the MortgageOverview page.
 *
 * Covers:
 *   - Empty state (no loans configured)
 *   - Single facility: all four sections render; correct tile labels present
 *   - Exactly one amortisation card (two mode-toggle buttons, no per-facility charts)
 *   - Exactly one extra payment input (no per-facility simulators)
 *   - Multiple facilities: loan grouping, "Facility Breakdown" subheader
 *   - Mixed rateTypes: page renders without error
 *   - Early repayment: result tiles appear after non-zero input, absent at zero
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import MortgageOverview from '../../pages/MortgageOverview';
import { usePeopleStore } from '../../store/peopleStore';
import { useFinanceStore } from '../../store/financeStore';

// ── ResizeObserver stub (required by recharts ResponsiveContainer) ────────────
beforeAll(() => {
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// ── helpers ───────────────────────────────────────────────────────────────────

function resetStores() {
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
  useFinanceStore.setState({
    accounts: [{ id: 'main', name: 'Savings', balance: 0 }],
    assetIncomes: [], fortnightlyData: {}, goals: [], transfers: [],
    settings: { currentBalance: 0 },
  });
}

function seedLoan(facilities, loanOverrides = {}) {
  usePeopleStore.setState({
    people: [], wishlist: [],
    expenses: [{
      id: 'loan1', name: 'Home Loan', lender: 'ANZ',
      amount: 0, frequency: 'fortnightly', type: 'loan',
      ...loanOverrides,
      facilities,
    }],
  });
}

const F_FIXED = {
  id: 'f1', label: 'Fixed', balance: 400000, rate: 6.5, amount: 1200,
  frequency: 'fortnightly', rateType: 'fixed', repaymentType: 'P&I',
};

const F_FLOATING = {
  id: 'f2', label: 'Floating', balance: 100000, rate: 7.0, amount: 350,
  frequency: 'fortnightly', rateType: 'floating', repaymentType: 'P&I',
};

const F_REVOLVING = {
  id: 'f3', label: 'Revolving Credit', balance: 50000, rate: 7.5, amount: 250,
  frequency: 'fortnightly', rateType: 'revolving', repaymentType: 'P&I',
};

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── empty state ───────────────────────────────────────────────────────────────

describe('MortgageOverview — no loans', () => {
  it('renders Current Position section', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Current Position')).toBeInTheDocument();
  });

  it('renders Amortisation section', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Amortisation')).toBeInTheDocument();
  });

  it('shows empty-state message inside Current Position', () => {
    render(<MortgageOverview />);
    expect(screen.getByText(/No loans set up yet/i)).toBeInTheDocument();
  });

  it('shows amortisation empty-state message', () => {
    render(<MortgageOverview />);
    expect(screen.getByText(/No amortisation data/i)).toBeInTheDocument();
  });

  it('does not render Facilities section', () => {
    render(<MortgageOverview />);
    expect(screen.queryByRole('heading', { name: /^Facilities$/i })).toBeNull();
  });

  it('does not render Early Repayment section', () => {
    render(<MortgageOverview />);
    expect(screen.queryByText('Early Repayment')).toBeNull();
  });
});

// ── single facility ───────────────────────────────────────────────────────────

describe('MortgageOverview — single fixed facility', () => {
  beforeEach(() => seedLoan([F_FIXED]));

  it('renders all four section headings', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Current Position')).toBeInTheDocument();
    expect(screen.getByText('Amortisation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Facilities$/i })).toBeInTheDocument();
    expect(screen.getByText('Early Repayment')).toBeInTheDocument();
  });

  it('renders Current Position summary tile labels', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
    expect(screen.getAllByText('Repayment /fn').length).toBeGreaterThan(0);
    expect(screen.getByText('Total Interest Left')).toBeInTheDocument();
    expect(screen.getByText('Payoff Year')).toBeInTheDocument();
  });

  it('renders amortisation mode toggle buttons', () => {
    render(<MortgageOverview />);
    expect(screen.getByRole('button', { name: 'Balance Over Time' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Principal vs Interest' })).toBeInTheDocument();
  });

  it('exactly two toggle buttons — one amortisation card only', () => {
    render(<MortgageOverview />);
    const btns = screen.getAllByRole('button', { name: /Balance Over Time|Principal vs Interest/ });
    expect(btns).toHaveLength(2);
  });

  it('renders facility stat labels inside the facility card', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Rate Type')).toBeInTheDocument();
    expect(screen.getByText('Interest Rate')).toBeInTheDocument();
    expect(screen.getByText('Remaining Term')).toBeInTheDocument();
    expect(screen.getByText('Total Interest')).toBeInTheDocument();
  });

  it('renders exactly one extra payment input', () => {
    render(<MortgageOverview />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  });

  it('does not render per-facility chart title inside facility card', () => {
    render(<MortgageOverview />);
    // Old per-facility chart used this title — must not appear
    expect(screen.queryByText('Annual Principal vs Interest')).toBeNull();
    expect(screen.queryByText('Balance Over Time', { selector: '.mfac-chart-title' })).toBeNull();
  });

  it('does not render result tiles when extra payment input is empty', () => {
    render(<MortgageOverview />);
    expect(screen.queryByText('New Payoff Year')).toBeNull();
    expect(screen.queryByText('Interest Saved')).toBeNull();
    expect(screen.queryByText('Time Saved')).toBeNull();
  });

  it('renders result tiles after a meaningful extra payment is entered', () => {
    render(<MortgageOverview />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '200' } });
    expect(screen.getByText('New Payoff Year')).toBeInTheDocument();
    expect(screen.getByText('Interest Saved')).toBeInTheDocument();
    expect(screen.getByText('Time Saved')).toBeInTheDocument();
  });

  it('hides result tiles when extra payment is reset to 0', () => {
    render(<MortgageOverview />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.queryByText('New Payoff Year')).toBeNull();
  });

  it('does not render "Facility Breakdown" subheader for a single facility', () => {
    render(<MortgageOverview />);
    expect(screen.queryByText('Facility Breakdown')).toBeNull();
  });
});

// ── multiple facilities ───────────────────────────────────────────────────────

describe('MortgageOverview — multiple facilities in one loan', () => {
  beforeEach(() => seedLoan([F_FIXED, F_FLOATING]));

  it('renders "Facility Breakdown" subheader', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Facility Breakdown')).toBeInTheDocument();
  });

  it('renders both facility labels', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Fixed')).toBeInTheDocument();
    expect(screen.getByText('Floating')).toBeInTheDocument();
  });

  it('still only one amortisation toggle pair (no per-facility toggles)', () => {
    render(<MortgageOverview />);
    expect(screen.getAllByRole('button', { name: 'Balance Over Time' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Principal vs Interest' })).toHaveLength(1);
  });

  it('still exactly one extra payment input', () => {
    render(<MortgageOverview />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  });

  it('renders Splits tile in per-loan summary', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Splits')).toBeInTheDocument();
  });
});

// ── mixed rateTypes ───────────────────────────────────────────────────────────

describe('MortgageOverview — mixed rateTypes (fixed, floating, revolving)', () => {
  beforeEach(() => seedLoan([F_FIXED, F_FLOATING, F_REVOLVING]));

  it('renders without throwing', () => {
    expect(() => render(<MortgageOverview />)).not.toThrow();
  });

  it('renders all three facility labels', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Fixed')).toBeInTheDocument();
    expect(screen.getByText('Floating')).toBeInTheDocument();
    expect(screen.getByText('Revolving Credit')).toBeInTheDocument();
  });

  it('still only one amortisation card and one simulator', () => {
    render(<MortgageOverview />);
    expect(screen.getAllByRole('button', { name: 'Balance Over Time' })).toHaveLength(1);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  });
});

// ── multiple loans ────────────────────────────────────────────────────────────

describe('MortgageOverview — two separate loans', () => {
  beforeEach(() => {
    usePeopleStore.setState({
      people: [], wishlist: [],
      expenses: [
        {
          id: 'loan1', name: 'Home Loan', lender: 'ANZ',
          amount: 0, frequency: 'fortnightly', type: 'loan',
          facilities: [F_FIXED],
        },
        {
          id: 'loan2', name: 'Investment Property', lender: 'BNZ',
          amount: 0, frequency: 'fortnightly', type: 'loan',
          facilities: [F_FLOATING],
        },
      ],
    });
  });

  it('renders both loan names', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('Home Loan')).toBeInTheDocument();
    expect(screen.getByText('Investment Property')).toBeInTheDocument();
  });

  it('renders both lender tags', () => {
    render(<MortgageOverview />);
    expect(screen.getByText('ANZ')).toBeInTheDocument();
    expect(screen.getByText('BNZ')).toBeInTheDocument();
  });

  it('still only one amortisation card and one simulator across two loans', () => {
    render(<MortgageOverview />);
    expect(screen.getAllByRole('button', { name: 'Balance Over Time' })).toHaveLength(1);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  });
});
