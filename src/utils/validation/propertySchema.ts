import { z } from 'zod';
import { PROPERTY_TYPES } from '../../models/Property';

/** Optional numeric field — accepts empty string or number, transforms to number | null. */
const optionalNum = z
  .union([z.string(), z.number(), z.null()])
  .transform(v => {
    if (v === '' || v == null) return null;
    return Number(v);
  })
  .pipe(
    z.number().min(0, 'Must be zero or greater').nullable(),
  );

/** Validates the Property add/edit form (Profile tab fields). */
export type PropertyFormData = z.infer<typeof propertySchema>;
export const propertySchema = z.object({
  name:      z.string().min(1, 'Property name is required'),
  type:      z.enum(PROPERTY_TYPES, { error: 'Select a valid property type' }),
  bedrooms:  optionalNum,
  bathrooms: optionalNum,
  landArea:  optionalNum,
  floorArea: optionalNum,
});
