import { db } from '../db';
import {
  products,
  opportunityLineItems,
  quotes,
  opportunities,
  companies,
} from '../db/schema';
import { eq, and, sql, desc, asc, ilike } from 'drizzle-orm';
import { logTimelineActivity } from './timeline';

export interface CreateProductInput {
  name: string;
  sku?: string;
  description?: string;
  defaultPriceMicros: number | string;
  currency?: string;
  organizationId?: string | null;
}

export interface AddLineItemInput {
  opportunityId: string;
  productId: string;
  quantity?: number;
  unitPriceMicros?: number | string;
  discountPercent?: number;
  userId?: string;
}

export interface GenerateQuoteInput {
  opportunityId: string;
  expiresInDays?: number;
  notes?: string;
  userId?: string;
}

/**
 * Create a new product in the catalog.
 */
export async function createProduct(input: CreateProductInput) {
  const [prod] = await db
    .insert(products)
    .values({
      name: input.name,
      sku: input.sku ?? null,
      description: input.description ?? null,
      defaultPriceMicros: input.defaultPriceMicros.toString(),
      currency: input.currency ?? 'USD',
      organizationId: input.organizationId ?? null,
      isActive: true,
    })
    .returning();

  return prod;
}

/**
 * List products from the catalog.
 */
export async function listProducts(options?: {
  query?: string;
  isActive?: boolean;
}) {
  const conditions = [];
  if (options?.query) {
    conditions.push(ilike(products.name, `%${options.query}%`));
  }
  if (options?.isActive !== undefined) {
    conditions.push(eq(products.isActive, options.isActive));
  }

  return await db.query.products.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [asc(products.name)],
  });
}

/**
 * Add a product line item to an opportunity and automatically recalculate
 * the opportunity's total amount_micros.
 */
export async function addOpportunityLineItem(input: AddLineItemInput) {
  const { opportunityId, productId, quantity = 1, discountPercent = 0, userId } = input;

  const [opp, product] = await Promise.all([
    db.query.opportunities.findFirst({ where: eq(opportunities.id, opportunityId) }),
    db.query.products.findFirst({ where: eq(products.id, productId) }),
  ]);

  if (!opp) throw new Error(`Opportunity ${opportunityId} not found`);
  if (!product) throw new Error(`Product ${productId} not found`);

  const unitPrice = input.unitPriceMicros
    ? BigInt(input.unitPriceMicros)
    : BigInt(product.defaultPriceMicros);

  const qty = BigInt(quantity);
  const disc = Number(discountPercent);

  // total = (qty * unitPrice) * (1 - disc / 100)
  const grossMicros = qty * unitPrice;
  const netMicros = BigInt(Math.round(Number(grossMicros) * (1.0 - disc / 100.0)));

  const [lineItem] = await db
    .insert(opportunityLineItems)
    .values({
      opportunityId,
      productId,
      quantity,
      unitPriceMicros: unitPrice.toString(),
      discountPercent: disc.toFixed(2),
      totalPriceMicros: netMicros.toString(),
    })
    .returning();

  // Recalculate total opportunity amount from all line items
  const allLineItems = await db.query.opportunityLineItems.findMany({
    where: eq(opportunityLineItems.opportunityId, opportunityId),
  });

  const totalOppMicros = allLineItems.reduce(
    (sum, item) => sum + BigInt(item.totalPriceMicros),
    BigInt(0)
  );

  await db
    .update(opportunities)
    .set({
      amountMicros: totalOppMicros.toString(),
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, opportunityId));

  // Log to Activity Timeline
  await logTimelineActivity({
    entityType: 'opportunity',
    entityId: opportunityId,
    activityType: 'LINE_ITEM_ADDED',
    actorSource: userId ? 'MANUAL' : 'AGENT',
    actorUserId: userId ?? null,
    actorName: userId ? 'CRM User' : 'CRM MCP Agent',
    properties: {
      productId,
      productName: product.name,
      quantity,
      unitPriceMicros: unitPrice.toString(),
      discountPercent: disc,
      lineItemTotalMicros: netMicros.toString(),
      newOpportunityTotalMicros: totalOppMicros.toString(),
    },
  });

  return {
    lineItem,
    product,
    newOpportunityTotalMicros: totalOppMicros.toString(),
  };
}

/**
 * Remove a line item and recalculate opportunity amount.
 */
export async function removeOpportunityLineItem(lineItemId: string, userId?: string) {
  const lineItem = await db.query.opportunityLineItems.findFirst({
    where: eq(opportunityLineItems.id, lineItemId),
    with: { product: true },
  });

  if (!lineItem) throw new Error(`Line item ${lineItemId} not found`);

  await db.delete(opportunityLineItems).where(eq(opportunityLineItems.id, lineItemId));

  const allLineItems = await db.query.opportunityLineItems.findMany({
    where: eq(opportunityLineItems.opportunityId, lineItem.opportunityId),
  });

  const totalOppMicros = allLineItems.reduce(
    (sum, item) => sum + BigInt(item.totalPriceMicros),
    BigInt(0)
  );

  await db
    .update(opportunities)
    .set({
      amountMicros: totalOppMicros.toString(),
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, lineItem.opportunityId));

  await logTimelineActivity({
    entityType: 'opportunity',
    entityId: lineItem.opportunityId,
    activityType: 'LINE_ITEM_REMOVED',
    actorSource: userId ? 'MANUAL' : 'AGENT',
    actorUserId: userId ?? null,
    actorName: userId ? 'CRM User' : 'CRM MCP Agent',
    properties: {
      productId: lineItem.productId,
      productName: lineItem.product?.name,
      newOpportunityTotalMicros: totalOppMicros.toString(),
    },
  });

  return {
    success: true,
    deletedLineItemId: lineItemId,
    newOpportunityTotalMicros: totalOppMicros.toString(),
  };
}

/**
 * Generate a formal Quote from an opportunity's line items.
 */
export async function generateQuote(input: GenerateQuoteInput) {
  const { opportunityId, expiresInDays = 30, notes, userId } = input;

  const opp = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, opportunityId),
    with: {
      company: true,
      lineItems: {
        with: { product: true },
      },
    },
  });

  if (!opp) throw new Error(`Opportunity ${opportunityId} not found`);
  if (!opp.lineItems || opp.lineItems.length === 0) {
    throw new Error(`Opportunity "${opp.name}" has no line items. Add line items before generating a quote.`);
  }

  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const quoteNumber = `Q-${year}-${randomSuffix}`;

  const totalAmountMicros = opp.lineItems.reduce(
    (sum, item) => sum + BigInt(item.totalPriceMicros),
    BigInt(0)
  );

  const expiresAt = new Date(Date.now() + expiresInDays * 86400000);

  const [quote] = await db
    .insert(quotes)
    .values({
      opportunityId,
      organizationId: opp.organizationId,
      quoteNumber,
      status: 'DRAFT',
      totalAmountMicros: totalAmountMicros.toString(),
      currency: opp.currency || 'USD',
      expiresAt,
      notes: notes ?? null,
    })
    .returning();

  await logTimelineActivity({
    entityType: 'opportunity',
    entityId: opportunityId,
    activityType: 'QUOTE_GENERATED',
    actorSource: userId ? 'MANUAL' : 'AGENT',
    actorUserId: userId ?? null,
    actorName: userId ? 'CRM User' : 'CRM CPQ Engine',
    properties: {
      quoteId: quote.id,
      quoteNumber,
      totalAmountMicros: totalAmountMicros.toString(),
      expiresAt: expiresAt.toISOString(),
      itemCount: opp.lineItems.length,
    },
  });

  return {
    quote,
    opportunity: {
      id: opp.id,
      name: opp.name,
      company: opp.company?.name,
    },
    lineItems: opp.lineItems.map((li) => ({
      id: li.id,
      productName: li.product.name,
      sku: li.product.sku,
      quantity: li.quantity,
      unitPriceMicros: li.unitPriceMicros,
      discountPercent: li.discountPercent,
      totalPriceMicros: li.totalPriceMicros,
    })),
  };
}

/**
 * Update quote status (SENT, ACCEPTED, REJECTED, EXPIRED).
 */
export async function updateQuoteStatus(quoteId: string, status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED', userId?: string) {
  const [updated] = await db
    .update(quotes)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId))
    .returning();

  if (!updated) throw new Error(`Quote ${quoteId} not found`);

  if (status === 'ACCEPTED') {
    await logTimelineActivity({
      entityType: 'opportunity',
      entityId: updated.opportunityId,
      activityType: 'QUOTE_ACCEPTED',
      actorSource: userId ? 'MANUAL' : 'AGENT',
      actorUserId: userId ?? null,
      actorName: userId ? 'CRM User' : 'CRM CPQ Engine',
      properties: {
        quoteId,
        quoteNumber: updated.quoteNumber,
        totalAmountMicros: updated.totalAmountMicros,
      },
    });
  }

  return updated;
}

/**
 * Retrieve quotes and line items for an opportunity.
 */
export async function getOpportunityQuotes(opportunityId: string) {
  const [opp, oppQuotes, lineItems] = await Promise.all([
    db.query.opportunities.findFirst({ where: eq(opportunities.id, opportunityId) }),
    db.query.quotes.findMany({
      where: eq(quotes.opportunityId, opportunityId),
      orderBy: [desc(quotes.createdAt)],
    }),
    db.query.opportunityLineItems.findMany({
      where: eq(opportunityLineItems.opportunityId, opportunityId),
      with: { product: true },
    }),
  ]);

  if (!opp) throw new Error(`Opportunity ${opportunityId} not found`);

  return {
    opportunityId,
    opportunityName: opp.name,
    amountMicros: opp.amountMicros,
    lineItems: lineItems.map((li) => ({
      id: li.id,
      productId: li.productId,
      productName: li.product.name,
      sku: li.product.sku,
      quantity: li.quantity,
      unitPriceMicros: li.unitPriceMicros,
      discountPercent: li.discountPercent,
      totalPriceMicros: li.totalPriceMicros,
    })),
    quotes: oppQuotes,
  };
}
