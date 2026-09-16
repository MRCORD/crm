import { db } from '../db';
import { brands, opportunities, products, sequences, views } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export interface CreateBrandInput {
  name: string;
  slug: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  color?: string;
}

/**
 * Create a new brand / DBA entry.
 */
export async function createBrand(input: CreateBrandInput) {
  const [created] = await db
    .insert(brands)
    .values({
      name: input.name,
      slug: input.slug.toLowerCase().replace(/\s+/g, '-'),
      description: input.description ?? null,
      website: input.website ?? null,
      logoUrl: input.logoUrl ?? null,
      color: input.color ?? 'gray',
      isActive: true,
    })
    .returning();

  return created;
}

/**
 * List all brands / DBAs.
 */
export async function listBrands(activeOnly = true) {
  return await db.query.brands.findMany({
    where: activeOnly ? eq(brands.isActive, true) : undefined,
    orderBy: [brands.name],
  });
}

/**
 * Assign a brand to an opportunity, product, sequence, or view.
 */
export async function assignBrand(options: {
  entityType: 'opportunity' | 'product' | 'sequence' | 'view';
  recordId: string;
  brandId: string | null;
}) {
  const { entityType, recordId, brandId } = options;

  let updated;
  if (entityType === 'opportunity') {
    [updated] = await db.update(opportunities).set({ brandId, updatedAt: new Date() }).where(eq(opportunities.id, recordId)).returning();
  } else if (entityType === 'product') {
    [updated] = await db.update(products).set({ brandId, updatedAt: new Date() }).where(eq(products.id, recordId)).returning();
  } else if (entityType === 'sequence') {
    [updated] = await db.update(sequences).set({ brandId, updatedAt: new Date() }).where(eq(sequences.id, recordId)).returning();
  } else {
    [updated] = await db.update(views).set({ brandId, updatedAt: new Date() }).where(eq(views.id, recordId)).returning();
  }

  return updated;
}

/**
 * Get pipeline summary grouped by brand.
 * Returns total open deals and total pipeline amount per brand.
 */
export async function getBrandPipelineSummary() {
  const allBrands = await db.query.brands.findMany({
    where: eq(brands.isActive, true),
  });

  const results = await Promise.all(
    allBrands.map(async (brand) => {
      const deals = await db.query.opportunities.findMany({
        where: and(
          eq(opportunities.brandId, brand.id),
          isNull(opportunities.deletedAt)
        ),
      });

      const activeDeal = deals.filter((d) => !['CLOSED_WON', 'CLOSED_LOST'].includes(d.stage));
      const wonDeals = deals.filter((d) => d.stage === 'CLOSED_WON');

      const activePipelineMicros = activeDeal.reduce((sum, d) => sum + BigInt(d.amountMicros), BigInt(0));
      const wonAmountMicros = wonDeals.reduce((sum, d) => sum + BigInt(d.amountMicros), BigInt(0));

      return {
        brand: { id: brand.id, name: brand.name, slug: brand.slug, color: brand.color },
        totalDeals: deals.length,
        activeDeals: activeDeal.length,
        wonDeals: wonDeals.length,
        activePipelineMicros: activePipelineMicros.toString(),
        wonAmountMicros: wonAmountMicros.toString(),
      };
    })
  );

  return results;
}
