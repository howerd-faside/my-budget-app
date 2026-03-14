/**
 * Shared expense category definitions.
 * Used by Expenses.jsx, Dashboard.jsx, and FinancialTracking.jsx.
 *
 * Each group has an id, label, icon, color, and cats array.
 * Categories must be globally unique (no cat should appear in two groups).
 */

export interface ExpenseGroup {
  id: string;
  label: string;
  icon: string;
  color: string;
  cats: string[];
}

export const EXPENSE_GROUPS: ExpenseGroup[] = [
  { id: 'housing',   label: 'Housing',      icon: '\u{1F3E0}', color: '#2fd4e8',
    cats: ['Mortgage', 'Rent', 'Rates', 'Body Corporate', 'Maintenance', 'Cleaning & Garden'] },
  { id: 'utilities', label: 'Utilities',    icon: '\u26A1',     color: '#bf5af2',
    cats: ['Power', 'Gas / LPG', 'Water', 'Internet', 'Mobile'] },
  { id: 'transport', label: 'Transport',    icon: '\u{1F697}', color: '#30d158',
    cats: ['Vehicle Loan', 'Fuel', 'WOF & Rego', 'Public Transport', 'Parking'] },
  { id: 'food',      label: 'Food & Drink', icon: '\u{1F34E}', color: '#f97316',
    cats: ['Groceries', 'Dining Out', 'Coffee & Drinks', 'Alcohol'] },
  { id: 'insurance', label: 'Insurance',    icon: '\u{1F510}', color: '#ffd60a',
    cats: ['Health Insurance', 'Life Insurance', 'House Insurance', 'Contents Insurance', 'Income Protection', 'Vehicle Insurance'] },
  { id: 'family',    label: 'Family',       icon: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', color: '#ec4899',
    cats: ['Childcare', 'School Fees', 'Activities', 'Pets', 'Baby & Infant', 'Gifts & Giving'] },
  { id: 'health',    label: 'Health',       icon: '\u{1F48A}', color: '#14b8a6',
    cats: ['Medical & Dental', 'Prescriptions', 'Eyecare', 'Mental Health', 'Gym & Fitness'] },
  { id: 'lifestyle', label: 'Lifestyle',    icon: '\u{1F3AD}', color: '#6366f1',
    cats: ['Subscriptions', 'Entertainment', 'Clothing', 'Holidays & Travel', 'Personal Care', 'Hobbies'] },
  { id: 'finance',   label: 'Finance',      icon: '\u{1F4B3}', color: '#8B5CF6',
    cats: ['Personal Loan', 'Hire Purchase', 'Bank Fees', 'Credit Card Interest'] },
  { id: 'personal',  label: 'Personal',     icon: '\u{1F4B3}', color: '#30d158',
    cats: ['Spending Money'] },
  { id: 'other',     label: 'Other',        icon: '\u{1F4E6}', color: '#707090',
    cats: ['Other'] },
];

export const CATEGORIES: string[] = EXPENSE_GROUPS.flatMap(g => g.cats);

export const ADHOC_EXPENSE_CATS: string[] = [
  'Groceries', 'Dining Out', 'Coffee & Drinks', 'Clothing', 'Medical & Dental',
  'Home', 'Entertainment', 'Pets', 'Family', 'Fuel', 'Holidays & Travel',
  'Gift', 'Personal Care', 'Hobbies', 'Other',
];

export function getCatColor(cat: string): string {
  const g = EXPENSE_GROUPS.find(g => g.cats.includes(cat));
  return g?.color ?? '#707090';
}

export function getCatGroup(cat: string): ExpenseGroup | undefined {
  return EXPENSE_GROUPS.find(g => g.cats.includes(cat));
}
