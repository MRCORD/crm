/**
 * Seed the real Fudis product catalog (Oracle, Maître 4 tiers, Agency)
 * into crm.products, scoped to the Fudis brand.
 *
 * Source: /Users/oscar-rivas/Github/00ACTIVE/fudis/handbook/products/pricing.md
 * (published pricing as of 2026-08-21, synced with fudis.app/negocios/precios)
 *
 * All prices are USD per location per month, ex-VAT, except Fudis Agency
 * which is priced per year (public starting price).
 *
 * Usage: npx tsx src/db/scripts/seed-fudis-products.ts
 */
import 'dotenv/config';
import { db } from '../index';
import { products, brands } from '../schema';
import { eq } from 'drizzle-orm';

const FUDIS_PRODUCTS = [
  {
    name: 'Fudis Oracle',
    sku: 'FUDIS-ORACLE',
    description:
      'Ask-your-data Q&A layer for restaurant operators (MCP/Claude/ChatGPT compatible) plus RMS/POS/menu data sync. Entry-level tier, monthly per location. Does not include bookings, waitlist, WhatsApp channel, or back office.',
    defaultPriceDollars: 150,
  },
  {
    name: 'Fudis Maître — Anfitrión (T1)',
    sku: 'FUDIS-MAITRE-T1',
    description:
      'Everything in Oracle, plus: digital menu, 1 WhatsApp account for reservations, back office. Entry Maître tier for single-location operators.',
    defaultPriceDollars: 300,
  },
  {
    name: 'Fudis Maître — Inteligencia (T2)',
    sku: 'FUDIS-MAITRE-T2',
    description:
      'Everything in Anfitrión (T1), plus: up to 2 WhatsApp accounts for reservations.',
    defaultPriceDollars: 500,
  },
  {
    name: 'Fudis Maître — Activación (T3)',
    sku: 'FUDIS-MAITRE-T3',
    description:
      'Everything in Inteligencia (T2), plus: up to 6 WhatsApp accounts, voice agents for phone calls. Recommended from 2+ locations.',
    defaultPriceDollars: 800,
  },
  {
    name: 'Fudis Maître — Superinteligencia (T4)',
    sku: 'FUDIS-MAITRE-T4',
    description:
      'Everything in Activación (T3), plus: 6+ WhatsApp accounts, Social Inbox (agents answering Instagram/Facebook/TikTok DMs). Top tier.',
    defaultPriceDollars: 1600,
  },
  {
    name: 'Fudis Agency',
    sku: 'FUDIS-AGENCY',
    description:
      'Ads and social management (Instagram/Facebook ads, content, reporting). Sold separately from Oracle and Maître. Public starting price shown; larger engagements priced case by case.',
    defaultPriceDollars: 120, // per year, not per month — see priceNote below
    priceNote: 'per year (not monthly, unlike Oracle/Maître)',
  },
];

async function main() {
  console.log('============================================================');
  console.log('Seeding Fudis Product Catalog (Oracle, Maître T1-T4, Agency)');
  console.log('============================================================\n');

  const fudisBrand = await db.query.brands.findFirst({
    where: eq(brands.slug, 'fudis'),
  });

  if (!fudisBrand) {
    throw new Error('Fudis brand not found in crm.brands. Run seed-brands.ts first.');
  }

  for (const p of FUDIS_PRODUCTS) {
    const existing = await db.query.products.findFirst({
      where: eq(products.sku, p.sku),
    });

    if (existing) {
      console.log(`  = Exists: "${p.name}" (${p.sku})`);
      continue;
    }

    await db.insert(products).values({
      name: p.name,
      sku: p.sku,
      description: p.description,
      defaultPriceMicros: (p.defaultPriceDollars * 1_000_000).toString(),
      currency: 'USD',
      brandId: fudisBrand.id,
      isActive: true,
    });

    const cadence = p.priceNote ? p.priceNote : 'per location/month';
    console.log(`  + Created: "${p.name}" — $${p.defaultPriceDollars} ${cadence}`);
  }

  console.log('\n============================================================');
  console.log('Fudis catalog seeded. Source: handbook/products/pricing.md (2026-08-21)');
  console.log('============================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('\n[FATAL] Seeding failed:', err);
  process.exit(1);
});
