/**
 * @fileoverview Domain model for a wishlist item.
 *
 * Inconsistencies detected:
 * - `id` is absent from the EMPTY template in Wishlist.jsx; it is injected at
 *   save-time via `uid()`. This means a newly-created item has no id until it is
 *   persisted, which prevents optimistic UI updates from referencing the record
 *   reliably before the first save.
 * - `purchased` is a boolean but `estimatedCost` is stored as a string (the raw
 *   value from a text input) and coerced to a number at calculation time via `+`.
 *   This causes `estimatedCost: ''` (no cost entered) and `estimatedCost: 0`
 *   (explicitly zero) to be treated identically in affordability logic.
 * - There is no `purchasedDate` field to record when an item was actually bought,
 *   so purchased items have no timestamp and cannot be sorted chronologically.
 */

/**
 * @typedef {Object} WishlistItem
 * @property {string}        id            - Unique identifier (injected at save-time)
 * @property {string}        name          - Item name
 * @property {number|string} estimatedCost - Estimated cost in NZD, or '' if unknown
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
 * Coerce a raw wishlist item to the canonical shape.
 * @param {object} raw
 * @returns {WishlistItem}
 */
export function normalizeWishlistItem(raw = {}) {
  return createWishlistItem({
    id:            raw.id            ?? '',
    name:          raw.name          ?? '',
    estimatedCost: raw.estimatedCost ?? '',
    notes:         raw.notes         ?? '',
    purchased:     raw.purchased     ?? false,
  });
}
