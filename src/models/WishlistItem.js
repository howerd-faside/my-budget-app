/**
 * @fileoverview Domain model for a wishlist item.
 *
 * Inconsistencies detected:
 * - `id` is absent from the EMPTY template in Wishlist.jsx; it is injected at
 *   save-time via `uid()`. This means a newly-created item has no id until it is
 *   persisted, which prevents optimistic UI updates from referencing the record
 *   reliably before the first save.
 * - `purchased` is a boolean but `estimatedCost` was historically stored as a
 *   string from a text input. After normalization it is always a number or null.
 *   null means "cost not entered"; 0 means explicitly free.
 * - There is no `purchasedDate` field to record when an item was actually bought,
 *   so purchased items have no timestamp and cannot be sorted chronologically.
 *
 * Numeric normalization:
 *   `normalizeWishlistItem` coerces `estimatedCost` to number | null.
 *   `createWishlistItem` retains `''` default for form binding.
 */

/**
 * @typedef {Object} WishlistItem
 * @property {string}        id            - Unique identifier (injected at save-time)
 * @property {string}        name          - Item name
 * @property {number|null}   estimatedCost - Estimated cost in NZD, or null if unknown
 * @property {string}        notes         - Free-text notes
 * @property {boolean}       purchased     - Whether the item has been purchased
 */

/**
 * Factory — returns a blank WishlistItem with sensible defaults.
 * id is left empty; it should be assigned via uid() before persisting.
 * @param {Partial<WishlistItem>} overrides
 * @returns {WishlistItem}
 */
export function createWishlistItem(overrides = {}) {
  return {
    id:            '',
    name:          '',
    estimatedCost: '',
    notes:         '',
    purchased:     false,
    ...overrides,
  };
}

/**
 * Parse an optional numeric value; returns `null` for empty/absent/invalid.
 * @param {*} val
 * @returns {number|null}
 */
function toNumOrNull(val) {
  if (val === '' || val == null) return null;
  const n = parseFloat(val);
  return isFinite(n) ? n : null;
}

/**
 * Coerce a raw wishlist item to the canonical shape.
 * `estimatedCost` is normalized to number | null; null means "cost not entered".
 * @param {object} raw
 * @returns {WishlistItem}
 */
export function normalizeWishlistItem(raw = {}) {
  return createWishlistItem({
    id:            raw.id        ?? '',
    name:          raw.name      ?? '',
    estimatedCost: toNumOrNull(raw.estimatedCost),
    notes:         raw.notes     ?? '',
    purchased:     raw.purchased ?? false,
  });
}
