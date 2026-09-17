/**
 * Seed initial DBA/operating brands into the CRM.
 * Safe to re-run — skips brands that already exist by slug.
 *
 * Usage: pnpm tsx src/db/scripts/seed-brands.ts
 */
import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import { brands } from '../schema';
import { eq } from 'drizzle-orm';
const BRANDS = [
  {
    name: 'Healthcare Solutions',
    slug: 'healthcare',
    description: 'Telehealth and clinical provider workflow platform',
    color: '#06b6d4',
  },
  {
    name: 'Hospitality Tech',
    slug: 'hospitality',
    description: 'Food & beverage POS and guest intelligence platform',
    color: '#10b981',
  },
];

async function main() {
  console.log('[Brands] Seeding operating brands into CRM...\n');

  for (const b of BRANDS) {
    const existing = await db.query.brands.findFirst({ where: eq(brands.slug, b.slug) });

    if (existing) {
      console.log(`  ⏭  ${b.name} (${b.slug}) already exists [ID: ${existing.id}] — skipped`);
      continue;
    }

    const result = await crmToolHandlers.createBrand(b);
    console.log(`  ✅ Created: ${result.brand.name} (${result.brand.slug}) [ID: ${result.brand.id}]`);
  }

  console.log('\n[Brands] Running cross-brand pipeline summary...');
  const summary = await crmToolHandlers.getBrandPipelineSummary();
  console.log(`  Total brands: ${summary.brands.length}`);
  console.log(`  Total active pipeline: $${(Number(summary.totalActivePipelineMicros) / 1_000_000).toLocaleString()}`);
  for (const b of summary.brands) {
    console.log(`  • ${b.brand.name}: ${b.activeDeals} active deals, $${(Number(b.activePipelineMicros) / 1_000_000).toLocaleString()} pipeline`);
  }

  console.log('\n[Brands] Done! To assign a deal to a brand:');
  console.log('  crm_assign_brand({ entityType: "opportunity", recordId: "<uuid>", brandId: "<brand_uuid>" })');

  process.exit(0);
}

main().catch((err) => {
  console.error('[Brands] Error:', err);
  process.exit(1);
});
