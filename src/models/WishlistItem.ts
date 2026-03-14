/**
 * @fileoverview Domain model for a wishlist item.
 *
 * Numeric normalization:
 *   `normalizeWishlistItem` coerces `estimatedCost` to number | null.
 *   `createWishlistItem` retains `''` default for form binding.
 */

export interface WishlistItem {
  id: string;
  name: string;
  estimatedCost: number | null;
  notes: string;
  purchased: boolean;
}

export function createWishlistItem(overrides: any = {}) {
  return {
    id:            '',
    name:          '',
    estimatedCost: '',
    notes:         '',
    purchased:     false,
    ...overrides,
  };
}

function toNumOrNull(val: any): number | null {
  if (val === '' || val == null) return null;
  const n = parseFloat(val);
  return isFinite(n) ? n : null;
}

export function normalizeWishlistItem(raw: any = {}): WishlistItem {
  return createWishlistItem({
    id:            raw.id        ?? '',
    name:          raw.name      ?? '',
    estimatedCost: toNumOrNull(raw.estimatedCost),
    notes:         raw.notes     ?? '',
    purchased:     raw.purchased ?? false,
  });
}
