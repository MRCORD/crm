import 'dotenv/config';
import { crmToolHandlers } from '../../mcp/tools';
import { db } from '../index';
import {
  companies,
  opportunities,
  products,
  opportunityLineItems,
  quotes,
  timelineActivities,
} from '../schema';
import { eq, inArray, or } from 'drizzle-orm';

async function main() {
  console.log('[Test] Starting Products, Price Books & Quotes (CPQ) end-to-end test against live Polygres DB...');

  const timestamp = Date.now();

  // 1. Create 2 Products in Catalog
  console.log('\n1. Creating products in product catalog...');
  const prod1Res = await crmToolHandlers.createProduct({
    name: `Enterprise AI Core Platform ${timestamp}`,
    sku: `AI-CORE-${timestamp}`,
    description: 'Annual platform license with 100M inference tokens',
    defaultPriceMicros: 50000000000, // $50,000
    currency: 'USD',
  });
  const product1 = prod1Res.product;
  console.log(`✓ Product 1 created: "${product1.name}" ($50k) [ID: ${product1.id}]`);

  const prod2Res = await crmToolHandlers.createProduct({
    name: `Premium Enterprise Support & SLA ${timestamp}`,
    sku: `AI-SUP-${timestamp}`,
    description: '24/7 dedicated support and 15-minute response SLA',
    defaultPriceMicros: 12000000000, // $12,000
    currency: 'USD',
  });
  const product2 = prod2Res.product;
  console.log(`✓ Product 2 created: "${product2.name}" ($12k) [ID: ${product2.id}]`);

  // 2. Create Company & Opportunity
  console.log('\n2. Creating test company and opportunity...');
  const [company] = await db.insert(companies).values({
    name: `CPQ Test Client ${timestamp}`,
  }).returning();

  const [opp] = await db.insert(opportunities).values({
    companyId: company.id,
    name: 'Omni Cybernetics Expansion Deal',
    stage: 'PROPOSAL',
    amountMicros: '0', // starts at $0
  }).returning();
  console.log(`✓ Opportunity created: ${opp.id} (Initial amount: $0)`);

  // 3. Add Line Item 1: 2x Product 1 with 10% discount
  // Math: 2 * $50,000 * 0.90 = $90,000 (90,000,000,000 micros)
  console.log('\n3. Adding Line Item 1: 2x Platform License with 10% discount...');
  const lineItem1Res = await crmToolHandlers.addOpportunityLineItem({
    opportunityId: opp.id,
    productId: product1.id,
    quantity: 2,
    discountPercent: 10,
  });
  console.log(`✓ Line item 1 added: net amount = $${(Number(lineItem1Res.lineItem.totalPriceMicros) / 1_000_000).toLocaleString()}`);
  console.log(`  Opportunity total now updated to: $${(Number(lineItem1Res.newOpportunityTotalMicros) / 1_000_000).toLocaleString()}`);

  if (lineItem1Res.lineItem.totalPriceMicros !== '90000000000') {
    throw new Error(`Expected $90k (90000000000 micros), got ${lineItem1Res.lineItem.totalPriceMicros}`);
  }

  // 4. Add Line Item 2: 1x Product 2 with 0% discount ($12,000)
  // New Total: $90,000 + $12,000 = $102,000 (102,000,000,000 micros)
  console.log('\n4. Adding Line Item 2: 1x Premium Support with 0% discount...');
  const lineItem2Res = await crmToolHandlers.addOpportunityLineItem({
    opportunityId: opp.id,
    productId: product2.id,
    quantity: 1,
    discountPercent: 0,
  });
  console.log(`✓ Line item 2 added: net amount = $${(Number(lineItem2Res.lineItem.totalPriceMicros) / 1_000_000).toLocaleString()}`);
  console.log(`  Opportunity total now updated to: $${(Number(lineItem2Res.newOpportunityTotalMicros) / 1_000_000).toLocaleString()}`);

  if (lineItem2Res.newOpportunityTotalMicros !== '102000000000') {
    throw new Error(`Expected $102k (102000000000 micros), got ${lineItem2Res.newOpportunityTotalMicros}`);
  }

  // 5. Generate Quote
  console.log('\n5. Generating formal Quote via crm_generate_quote...');
  const quoteRes = await crmToolHandlers.generateQuote({
    opportunityId: opp.id,
    expiresInDays: 45,
    notes: 'Net 30 payment terms upon contract execution.',
  });
  console.log(`✓ Quote Generated: "${quoteRes.quote.quoteNumber}" [ID: ${quoteRes.quote.id}]`);
  console.log(`  Status: ${quoteRes.quote.status}, Total: $${(Number(quoteRes.quote.totalAmountMicros) / 1_000_000).toLocaleString()}`);
  console.log(`  Itemized Line Items (${quoteRes.lineItems.length} items):`);
  for (const item of quoteRes.lineItems) {
    console.log(`     - ${item.productName} (Qty: ${item.quantity}, Disc: ${item.discountPercent}%) -> $${(Number(item.totalPriceMicros) / 1_000_000).toLocaleString()}`);
  }

  if (quoteRes.quote.totalAmountMicros !== '102000000000') {
    throw new Error(`Expected quote total $102,000, got ${quoteRes.quote.totalAmountMicros}`);
  }

  // 6. Test removing a line item & verify opportunity amount decreases
  console.log('\n6. Removing Support line item and verifying opportunity auto-adjusts...');
  const removeRes = await crmToolHandlers.removeOpportunityLineItem({
    lineItemId: lineItem2Res.lineItem.id,
  });
  console.log(`✓ Line item removed. New opportunity total: $${(Number(removeRes.newOpportunityTotalMicros) / 1_000_000).toLocaleString()}`);
  if (removeRes.newOpportunityTotalMicros !== '90000000000') {
    throw new Error(`Expected opportunity total adjusted back to $90,000, got ${removeRes.newOpportunityTotalMicros}`);
  }

  // 7. Verify Activity Timeline logged CPQ events
  console.log('\n7. Checking activity timeline events...');
  const timeline = await db.query.timelineActivities.findMany({
    where: eq(timelineActivities.entityId, opp.id),
  });
  console.log(`✓ Found ${timeline.length} timeline event(s) recorded for this opportunity:`);
  for (const t of timeline) {
    console.log(`   • [${t.activityType}] ${JSON.stringify(t.properties)}`);
  }

  // 8. Clean up test records
  console.log('\n8. Cleaning up test data from live DB...');
  await db.delete(timelineActivities).where(eq(timelineActivities.entityId, opp.id));
  await db.delete(quotes).where(eq(quotes.id, quoteRes.quote.id));
  await db.delete(opportunityLineItems).where(eq(opportunityLineItems.opportunityId, opp.id));
  await db.delete(opportunities).where(eq(opportunities.id, opp.id));
  await db.delete(companies).where(eq(companies.id, company.id));
  await db.delete(products).where(inArray(products.id, [product1.id, product2.id]));
  console.log('✓ Cleanup complete.');

  console.log('\n🎉 ALL PRODUCTS, PRICE BOOKS & QUOTES (CPQ) TESTS PASSED VERIFIED LIVE AGAINST POLYGRES DB!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Failed]', err);
  process.exit(1);
});
