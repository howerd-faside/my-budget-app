import { z } from 'zod';

/** Validates the Asset add/edit form. */
export type AssetFormData = z.infer<typeof assetSchema>;
export const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required'),
});
