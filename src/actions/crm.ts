"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/db"
import {
  companies,
  opportunities,
  people,
  brands,
  opportunityLineItems,
  quotes,
  products,
} from "@/db/schema"
import { eq, ilike, desc, isNull, sql, and } from "drizzle-orm"
import { logTimelineActivity, getTimelineActivities } from "@/lib/timeline"
import { getCompanyHierarchy, setParentCompany } from "@/lib/hierarchy"
import {
  addOpportunityLineItem,
  removeOpportunityLineItem,
  generateQuote,
  getOpportunityQuotes,
  listProducts,
} from "@/lib/cpq"
import { getPipelineFunnelReport } from "@/lib/reporting"
import { getBrandPipelineSummary, listBrands } from "@/lib/brands"

// ============================================================================
// COMPANIES ACTIONS
// ============================================================================

export async function getCompanies(search?: string) {
  const query = db
    .select({
      id: companies.id,
      name: companies.name,
      domainName: companies.domainName,
      industry: companies.industry,
      annualRevenueAmountMicros: companies.annualRevenueAmountMicros,
      annualRevenueCurrency: companies.annualRevenueCurrency,
      employeesCount: companies.employeesCount,
      addressCity: companies.addressCity,
      addressCountry: companies.addressCountry,
      visibility: companies.visibility,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
      dealCount: sql<number>`(
        select count(*)::int from crm.opportunities o
        where o.company_id = crm.companies.id and o.deleted_at is null
      )`,
      totalPipelineMicros: sql<string>`(
        select coalesce(sum(amount_micros::numeric), 0)::text from crm.opportunities o
        where o.company_id = crm.companies.id and o.deleted_at is null
      )`,
      peopleCount: sql<number>`(
        select count(*)::int from crm.people p
        where p.company_id = crm.companies.id and p.deleted_at is null
      )`,
    })
    .from(companies)
    .where(
      and(
        isNull(companies.deletedAt),
        search ? ilike(companies.name, `%${search}%`) : undefined
      )
    )
    .orderBy(desc(companies.createdAt))

  return await query
}

export async function getCompanyDetail(id: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), isNull(companies.deletedAt)))

  if (!company) return null

  // Related opportunities
  const relatedOpportunities = await db
    .select({
      id: opportunities.id,
      name: opportunities.name,
      stage: opportunities.stage,
      amountMicros: opportunities.amountMicros,
      currency: opportunities.currency,
      probabilityPercent: opportunities.probabilityPercent,
      closeDate: opportunities.closeDate,
      brandId: opportunities.brandId,
      createdAt: opportunities.createdAt,
    })
    .from(opportunities)
    .where(and(eq(opportunities.companyId, id), isNull(opportunities.deletedAt)))
    .orderBy(desc(opportunities.createdAt))

  // Related people
  const relatedPeople = await db
    .select()
    .from(people)
    .where(and(eq(people.companyId, id), isNull(people.deletedAt)))
    .orderBy(desc(people.createdAt))

  // Timeline activities
  const timeline = await getTimelineActivities({
    entityType: "company",
    entityId: id,
    limit: 25,
  })

  // Hierarchy
  let hierarchy = null
  try {
    hierarchy = await getCompanyHierarchy(id)
  } catch {
    // Non-blocking if hierarchy query fails
  }

  return {
    company,
    opportunities: relatedOpportunities,
    people: relatedPeople,
    timeline,
    hierarchy,
  }
}

export async function createCompanyAction(data: {
  name: string
  domainName?: string
  industry?: string
  annualRevenueMicros?: number
  addressCity?: string
  addressCountry?: string
}) {
  const [created] = await db
    .insert(companies)
    .values({
      name: data.name,
      domainName: data.domainName || null,
      industry: data.industry || null,
      annualRevenueAmountMicros: data.annualRevenueMicros
        ? data.annualRevenueMicros.toString()
        : null,
      addressCity: data.addressCity || null,
      addressCountry: data.addressCountry || null,
    })
    .returning()

  await logTimelineActivity({
    entityType: "company",
    entityId: created.id,
    activityType: "RECORD_CREATED",
    actorSource: "MANUAL",
    actorName: "Web UI",
    properties: { name: data.name, domain: data.domainName },
  })

  revalidatePath("/companies")
  revalidatePath("/")
  return created
}

export async function updateCompanyParentAction(
  companyId: string,
  parentCompanyId: string | null
) {
  const result = await setParentCompany({
    companyId,
    parentCompanyId,
  })
  revalidatePath(`/companies/${companyId}`)
  return result
}

// ============================================================================
// OPPORTUNITIES ACTIONS
// ============================================================================

export type OpportunityStage =
  | "DISCOVERY"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST"

export async function getOpportunities(brandId?: string) {
  const query = db
    .select({
      id: opportunities.id,
      name: opportunities.name,
      stage: opportunities.stage,
      amountMicros: opportunities.amountMicros,
      currency: opportunities.currency,
      probabilityPercent: opportunities.probabilityPercent,
      closeDate: opportunities.closeDate,
      healthScore: opportunities.healthScore,
      createdAt: opportunities.createdAt,
      companyId: opportunities.companyId,
      companyName: companies.name,
      companyDomain: companies.domainName,
      brandId: opportunities.brandId,
      brandName: brands.name,
      brandColor: brands.color,
    })
    .from(opportunities)
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .leftJoin(brands, eq(opportunities.brandId, brands.id))
    .where(
      and(
        isNull(opportunities.deletedAt),
        brandId ? eq(opportunities.brandId, brandId) : undefined
      )
    )
    .orderBy(desc(opportunities.createdAt))

  return await query
}

export async function getOpportunityDetail(id: string) {
  const [opp] = await db
    .select({
      id: opportunities.id,
      name: opportunities.name,
      stage: opportunities.stage,
      amountMicros: opportunities.amountMicros,
      currency: opportunities.currency,
      probabilityPercent: opportunities.probabilityPercent,
      closeDate: opportunities.closeDate,
      healthScore: opportunities.healthScore,
      lossReason: opportunities.lossReason,
      createdAt: opportunities.createdAt,
      updatedAt: opportunities.updatedAt,
      companyId: opportunities.companyId,
      companyName: companies.name,
      companyDomain: companies.domainName,
      brandId: opportunities.brandId,
      brandName: brands.name,
      brandColor: brands.color,
    })
    .from(opportunities)
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .leftJoin(brands, eq(opportunities.brandId, brands.id))
    .where(and(eq(opportunities.id, id), isNull(opportunities.deletedAt)))

  if (!opp) return null

  // Line items
  const lineItems = await db
    .select({
      id: opportunityLineItems.id,
      productId: opportunityLineItems.productId,
      productName: products.name,
      productSku: products.sku,
      quantity: opportunityLineItems.quantity,
      unitPriceMicros: opportunityLineItems.unitPriceMicros,
      discountPercent: opportunityLineItems.discountPercent,
      totalPriceMicros: opportunityLineItems.totalPriceMicros,
    })
    .from(opportunityLineItems)
    .innerJoin(products, eq(opportunityLineItems.productId, products.id))
    .where(eq(opportunityLineItems.opportunityId, id))
    .orderBy(opportunityLineItems.createdAt)
  // Quotes
  const quotesData = await getOpportunityQuotes(id)
  const quotesList = quotesData.quotes
  // Timeline
  const timeline = await getTimelineActivities({
    entityType: "opportunity",
    entityId: id,
    limit: 25,
  })
  // Available catalog products for add-line-item selector
  const catalogProducts = await listProducts({ isActive: true })

  return {
    opportunity: opp,
    lineItems,
    quotes: quotesList,
    timeline,
    products: catalogProducts,
  }
}

export async function updateOpportunityStageAction(
  opportunityId: string,
  newStage: OpportunityStage,
  reason?: string
) {
  const [updated] = await db
    .update(opportunities)
    .set({
      stage: newStage,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, opportunityId))
    .returning()

  if (updated) {
    await logTimelineActivity({
      entityType: "opportunity",
      entityId: opportunityId,
      activityType: "STAGE_CHANGED",
      actorSource: "MANUAL",
      actorName: "Web UI",
      properties: { to: newStage, reason },
    })

    if (updated.companyId) {
      await logTimelineActivity({
        entityType: "company",
        entityId: updated.companyId,
        activityType: "STAGE_CHANGED",
        actorSource: "MANUAL",
        actorName: "Web UI",
        properties: {
          opportunityId,
          opportunityName: updated.name,
          to: newStage,
          reason,
        },
      })
    }
  }

  revalidatePath("/opportunities")
  revalidatePath(`/opportunities/${opportunityId}`)
  revalidatePath("/")
  return updated
}

export async function createOpportunityAction(data: {
  name: string
  companyId: string
  amountMicros?: number
  stage?: OpportunityStage
  brandId?: string
  closeDate?: string
}) {
  const [created] = await db
    .insert(opportunities)
    .values({
      name: data.name,
      companyId: data.companyId,
      amountMicros: data.amountMicros ? data.amountMicros.toString() : "0",
      stage: data.stage || "DISCOVERY",
      brandId: data.brandId || null,
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
    })
    .returning()

  await logTimelineActivity({
    entityType: "opportunity",
    entityId: created.id,
    activityType: "RECORD_CREATED",
    actorSource: "MANUAL",
    actorName: "Web UI",
    properties: { name: data.name, stage: data.stage, amount: data.amountMicros },
  })

  revalidatePath("/opportunities")
  revalidatePath(`/companies/${data.companyId}`)
  revalidatePath("/")
  return created
}

// ============================================================================
// CPQ / LINE ITEMS / QUOTES ACTIONS
// ============================================================================

export async function addLineItemAction(data: {
  opportunityId: string
  productId: string
  quantity: number
  unitPriceMicros?: number
  discountPercent?: number
}) {
  const result = await addOpportunityLineItem({
    opportunityId: data.opportunityId,
    productId: data.productId,
    quantity: data.quantity,
    unitPriceMicros: data.unitPriceMicros,
    discountPercent: data.discountPercent,
  })

  revalidatePath(`/opportunities/${data.opportunityId}`)
  revalidatePath("/opportunities")
  return result
}

export async function removeLineItemAction(
  lineItemId: string,
  opportunityId: string
) {
  const result = await removeOpportunityLineItem(lineItemId)
  revalidatePath(`/opportunities/${opportunityId}`)
  revalidatePath("/opportunities")
  return result
}

export async function generateQuoteAction(
  opportunityId: string,
  notes?: string
) {
  const quote = await generateQuote({
    opportunityId,
    notes,
  })

  revalidatePath(`/opportunities/${opportunityId}`)
  return quote
}

// ============================================================================
// DASHBOARD & BRAND ACTIONS
// ============================================================================

export async function getDashboardData() {
  const funnel = await getPipelineFunnelReport()
  const brandSummary = await getBrandPipelineSummary()
  const brandsList = await listBrands(true)

  // Recent 5 opportunities
  const recentOpportunities = await db
    .select({
      id: opportunities.id,
      name: opportunities.name,
      stage: opportunities.stage,
      amountMicros: opportunities.amountMicros,
      currency: opportunities.currency,
      createdAt: opportunities.createdAt,
      companyName: companies.name,
      brandName: brands.name,
      brandColor: brands.color,
    })
    .from(opportunities)
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .leftJoin(brands, eq(opportunities.brandId, brands.id))
    .where(isNull(opportunities.deletedAt))
    .orderBy(desc(opportunities.createdAt))
    .limit(5)

  // Recent 5 companies
  const recentCompanies = await db
    .select({
      id: companies.id,
      name: companies.name,
      domainName: companies.domainName,
      industry: companies.industry,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .where(isNull(companies.deletedAt))
    .orderBy(desc(companies.createdAt))
    .limit(5)

  return {
    funnel,
    brandSummary,
    brands: brandsList,
    recentOpportunities,
    recentCompanies,
  }
}
