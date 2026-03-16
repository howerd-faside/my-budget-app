import { z } from 'zod';

/** Validates the Portfolio create/settings form. */
export type PortfolioFormData = z.infer<typeof portfolioSchema>;
export const portfolioSchema = z.object({
  name: z.string().min(1, 'Portfolio name is required'),
});
