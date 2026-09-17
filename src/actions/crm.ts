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
  sequences,
  sequenceEnrollments,
  assignmentRules,
  mergeCandidates,
  webhookSubscriptions,
  webhookDeliveries,
  mcpApprovals,
  fieldPermissions,
  customFieldDefinitions,
  customObjectDefinitions,
  customObjectRecords,
  tags,
  taggables,
} from "@/db/schema"
import { eq, ilike, desc, isNull, sql, and, or, inArray } from "drizzle-orm"
import { logTimelineActivity, getTimelineActivities } from "@/lib/timeline"
import { getCompanyHierarchy, setParentCompany } from "@/lib/hierarchy"
import {
  addOpportunityLineItem,
  removeOpportunityLineItem,
  generateQuote,
  getOpportunityQuotes,
  listProducts,
  createProduct,
} from "@/lib/cpq"
import {
  getPipelineFunnelReport,
  getRepPerformanceReport,
  getDealVelocityReport,
  getEngagementReport,
} from "@/lib/reporting"
import { getBrandPipelineSummary, listBrands, createBrand } from "@/lib/brands"
import {
  listStageCategories,
  createStageCategory,
  updateStageCategory,
  deleteStageCategory,
  listPipelineStages,
  createPipelineStage,
  updatePipelineStage,
  reorderPipelineStages,
  deletePipelineStage,
  listPipelineTemplates,
  saveCurrentPipelineAsTemplate,
  applyPipelineTemplate,
} from "@/lib/pipeline-stages"
import {
  listSequences,
  createSequence,
  enrollPersonInSequence,
  advanceSequenceStep,
  setEnrollmentStatus,
  StepDefinition,
} from "@/lib/sequences"
import {
  listAssignmentRules,
  createAssignmentRule,
  deleteAssignmentRule,
  routeAndAssignRecord,
  AssignmentStrategy,
} from "@/lib/routing"
import {
  listMergeCandidates,
  mergeRecords,
  dismissMergeCandidate,
} from "@/lib/duplicates"
import {
  listWebhookSubscriptions,
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookDeliveries,
} from "@/lib/webhooks"
import { importCSV, exportCSV } from "@/lib/csv"
import {
  listFieldPermissions,
  setFieldPermission,
} from "@/lib/permissions"

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

  const relatedPeople = await db
    .select()
    .from(people)
    .where(and(eq(people.companyId, id), isNull(people.deletedAt)))
    .orderBy(desc(people.createdAt))

  const timeline = await getTimelineActivities({
    entityType: "company",
    entityId: id,
    limit: 25,
  })

  let hierarchy = null
  try {
    hierarchy = await getCompanyHierarchy(id)
  } catch {}

  const stages = await listPipelineStages()

  return {
    company,
    opportunities: relatedOpportunities,
    people: relatedPeople,
    timeline,
    hierarchy,
    stages,
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

// Historically a fixed 5-value union; stages are now fully user-customizable
// (see crm.pipeline_stages), so this is kept as a named alias for a free-form
// stage key rather than churning every call site that imports the type.
export type OpportunityStage = string

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

  const quotesData = await getOpportunityQuotes(id)
  const quotesList = quotesData.quotes

  const timeline = await getTimelineActivities({
    entityType: "opportunity",
    entityId: id,
    limit: 25,
  })

  const catalogProducts = await listProducts({ isActive: true })
  const stages = await listPipelineStages()

  return {
    opportunity: opp,
    lineItems,
    quotes: quotesList,
    timeline,
    products: catalogProducts,
    stages,
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
// PIPELINE STAGES, CATEGORIES & TEMPLATES (custom, user-editable)
// ============================================================================

export async function getPipelineStagesAction() {
  return await listPipelineStages()
}

export async function getStageCategoriesAction() {
  return await listStageCategories()
}

export async function createStageCategoryAction(data: {
  key: string
  label: string
  color?: string
  isWon?: boolean
  isLost?: boolean
}) {
  const created = await createStageCategory(data)
  revalidatePath("/opportunities")
  return created
}

export async function updateStageCategoryAction(
  id: string,
  patch: { label?: string; color?: string; isWon?: boolean; isLost?: boolean }
) {
  const updated = await updateStageCategory(id, patch)
  revalidatePath("/opportunities")
  return updated
}

export async function deleteStageCategoryAction(id: string) {
  const result = await deleteStageCategory(id)
  revalidatePath("/opportunities")
  return result
}

export async function createPipelineStageAction(data: {
  key?: string
  label: string
  color?: string
  categoryId: string
}) {
  const created = await createPipelineStage(data)
  revalidatePath("/opportunities")
  return created
}

export async function updatePipelineStageAction(
  id: string,
  patch: { label?: string; color?: string; categoryId?: string }
) {
  const updated = await updatePipelineStage(id, patch)
  revalidatePath("/opportunities")
  return updated
}

export async function reorderPipelineStagesAction(orderedIds: string[]) {
  const result = await reorderPipelineStages(orderedIds)
  revalidatePath("/opportunities")
  return result
}

export async function deletePipelineStageAction(id: string) {
  const result = await deletePipelineStage(id)
  revalidatePath("/opportunities")
  return result
}

export async function getPipelineTemplatesAction() {
  return await listPipelineTemplates()
}

export async function applyPipelineTemplateAction(templateId: string) {
  const result = await applyPipelineTemplate(templateId)
  revalidatePath("/opportunities")
  return result
}

export async function saveCurrentPipelineAsTemplateAction(data: { name: string; description?: string }) {
  const result = await saveCurrentPipelineAsTemplate(data)
  revalidatePath("/opportunities")
  return result
}

// ============================================================================
// CPQ / PRODUCTS / LINE ITEMS / QUOTES
// ============================================================================

export async function getProductsAction(brandId?: string) {
  return await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      description: products.description,
      defaultPriceMicros: products.defaultPriceMicros,
      currency: products.currency,
      isActive: products.isActive,
      createdAt: products.createdAt,
      brandId: products.brandId,
      brandName: brands.name,
      brandColor: brands.color,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(
      and(
        eq(products.isActive, true),
        brandId ? eq(products.brandId, brandId) : undefined
      )
    )
    .orderBy(desc(products.createdAt))
}

export async function createProductAction(data: {
  name: string
  sku?: string
  description?: string
  defaultPriceDollars: number
  currency?: string
  brandId?: string
}) {
  const prod = await createProduct({
    name: data.name,
    sku: data.sku,
    description: data.description,
    defaultPriceMicros: Math.round(data.defaultPriceDollars * 1_000_000),
    currency: data.currency || "USD",
    brandId: data.brandId || null,
  })
  revalidatePath("/products")
  return prod
}

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
// PEOPLE (CONTACTS) ACTIONS
// ============================================================================

export async function getPeopleAction(search?: string) {
  return await db
    .select({
      id: people.id,
      firstName: people.firstName,
      lastName: people.lastName,
      email: people.email,
      phone: people.phone,
      jobTitle: people.jobTitle,
      linkedinUrl: people.linkedinUrl,
      createdAt: people.createdAt,
      companyId: people.companyId,
      companyName: companies.name,
    })
    .from(people)
    .leftJoin(companies, eq(people.companyId, companies.id))
    .where(
      and(
        isNull(people.deletedAt),
        search
          ? or(
              ilike(people.firstName, `%${search}%`),
              ilike(people.lastName, `%${search}%`),
              ilike(people.email, `%${search}%`)
            )
          : undefined
      )
    )
    .orderBy(desc(people.createdAt))
}

export async function createPersonAction(data: {
  firstName: string
  lastName?: string
  email: string
  phone?: string
  jobTitle?: string
  companyId?: string
}) {
  const [created] = await db
    .insert(people)
    .values({
      firstName: data.firstName,
      lastName: data.lastName || null,
      email: data.email,
      phone: data.phone || null,
      jobTitle: data.jobTitle || null,
      companyId: data.companyId || null,
    })
    .returning()

  await logTimelineActivity({
    entityType: "person",
    entityId: created.id,
    activityType: "RECORD_CREATED",
    actorSource: "MANUAL",
    actorName: "Web UI",
    properties: { name: `${data.firstName} ${data.lastName || ""}`.trim(), email: data.email },
  })

  revalidatePath("/people")
  if (data.companyId) revalidatePath(`/companies/${data.companyId}`)
  return created
}

// ============================================================================
// SEQUENCES ACTIONS
// ============================================================================

export async function getSequencesAction() {
  const list = await listSequences()
  const enrollments = await db
    .select({
      id: sequenceEnrollments.id,
      sequenceId: sequenceEnrollments.sequenceId,
      personId: sequenceEnrollments.personId,
      status: sequenceEnrollments.status,
      currentStep: sequenceEnrollments.currentStep,
      personEmail: people.email,
      personName: sql<string>`concat(${people.firstName}, ' ', ${people.lastName})`,
      sequenceName: sequences.name,
      enrolledAt: sequenceEnrollments.enrolledAt,
    })
    .from(sequenceEnrollments)
    .innerJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
    .innerJoin(people, eq(sequenceEnrollments.personId, people.id))
    .orderBy(desc(sequenceEnrollments.enrolledAt))

  return { sequences: list, enrollments }
}

export async function createSequenceAction(data: {
  name: string
  description?: string
  steps: StepDefinition[]
}) {
  const seq = await createSequence({
    name: data.name,
    description: data.description,
    steps: data.steps,
  })
  revalidatePath("/sequences")
  return seq
}

export async function enrollInSequenceAction(sequenceId: string, personId: string) {
  const result = await enrollPersonInSequence({ sequenceId, personId })
  revalidatePath("/sequences")
  return result
}

export async function advanceSequenceStepAction(enrollmentId: string) {
  const result = await advanceSequenceStep({ enrollmentId })
  revalidatePath("/sequences")
  return result
}

// ============================================================================
// ROUTING ACTIONS
// ============================================================================

export async function getRoutingRulesAction() {
  return await listAssignmentRules()
}

export async function createRoutingRuleAction(data: {
  name: string
  targetEntity: "companies" | "people" | "opportunities"
  strategy: AssignmentStrategy
  assigneeUserIds: string[]
  priority?: number
  conditions?: any[]
}) {
  const rule = await createAssignmentRule({
    name: data.name,
    targetEntity: data.targetEntity,
    assignmentStrategy: data.strategy,
    candidateUserIds: data.assigneeUserIds,
    conditions: (data.conditions || []) as any,
    priority: data.priority,
  })
  revalidatePath("/routing")
  return rule
}

export async function deleteRoutingRuleAction(ruleId: string) {
  await deleteAssignmentRule(ruleId)
  revalidatePath("/routing")
}

// ============================================================================
// DUPLICATES ACTIONS
// ============================================================================

export async function getDuplicatesAction() {
  return await listMergeCandidates({})
}

export async function mergeRecordsAction(data: {
  candidateId?: string
  entityType: "company" | "person"
  primaryRecordId: string
  secondaryRecordId: string
}) {
  const result = await mergeRecords({
    entityType: data.entityType,
    primaryRecordId: data.primaryRecordId,
    duplicateRecordId: data.secondaryRecordId,
  })
  if (data.candidateId) {
    await dismissMergeCandidate(data.candidateId)
  }
  revalidatePath("/duplicates")
  return result
}

export async function dismissCandidateAction(candidateId: string) {
  await dismissMergeCandidate(candidateId)
  revalidatePath("/duplicates")
}

// ============================================================================
// BRANDS ACTIONS
// ============================================================================

export async function getBrandsPageData() {
  const brandsList = await listBrands(false)
  const summary = await getBrandPipelineSummary()
  return { brands: brandsList, summary }
}

export async function createBrandAction(data: {
  name: string
  slug: string
  description?: string
  color?: string
}) {
  const created = await createBrand({
    name: data.name,
    slug: data.slug,
    description: data.description,
    color: data.color || "#06b6d4",
  })
  revalidatePath("/brands")
  revalidatePath("/")
  return created
}

// ============================================================================
// WEBHOOKS ACTIONS
// ============================================================================

export async function getWebhooksPageData() {
  const subscriptions = await listWebhookSubscriptions()
  const deliveries = await listWebhookDeliveries({ limit: 50 })
  return { subscriptions, deliveries }
}

export async function createWebhookAction(data: {
  name: string
  targetUrl: string
  eventTypes: string[]
  description?: string
}) {
  const sub = await createWebhookSubscription({
    name: data.name,
    targetUrl: data.targetUrl,
    eventTypes: data.eventTypes,
  })
  revalidatePath("/webhooks")
  return sub
}

export async function deleteWebhookAction(subscriptionId: string) {
  await deleteWebhookSubscription(subscriptionId)
  revalidatePath("/webhooks")
}

// ============================================================================
// IMPORT / EXPORT ACTIONS
// ============================================================================

export async function exportCsvAction(entityType: "companies" | "people" | "opportunities") {
  return await exportCSV({ entityType })
}

export async function importCsvAction(
  entityType: "companies" | "people" | "opportunities",
  csvString: string
) {
  const result = await importCSV({ entityType, csvContent: csvString })
  revalidatePath(`/${entityType}`)
  return result
}

// ============================================================================
// APPROVALS ACTIONS (Tier 4 HITL)
// ============================================================================

export async function getApprovalsAction() {
  return await db
    .select()
    .from(mcpApprovals)
    .orderBy(desc(mcpApprovals.createdAt))
}

export async function resolveApprovalAction(
  approvalId: string,
  status: "APPROVED" | "REJECTED",
  resolvedBy: string
) {
  const [updated] = await db
    .update(mcpApprovals)
    .set({
      status,
      assignedToUserId: resolvedBy,
      reviewedAt: new Date(),
    })
    .where(eq(mcpApprovals.id, approvalId))
    .returning()

  revalidatePath("/approvals")
  return updated
}

// ============================================================================
// REPORTS & DASHBOARDS ACTIONS
// ============================================================================

export async function getReportsData() {
  const [funnel, repPerf, velocity, engagement] = await Promise.all([
    getPipelineFunnelReport(),
    getRepPerformanceReport(),
    getDealVelocityReport(),
    getEngagementReport(),
  ])
  return { funnel, repPerf, velocity, engagement }
}

// ============================================================================
// SETTINGS ACTIONS (Permissions, Custom Fields, Custom Objects, Tags)
// ============================================================================

export async function getSettingsData() {
  const [perms, customFields, customObjects, allTags] = await Promise.all([
    listFieldPermissions(),
    db.select().from(customFieldDefinitions).orderBy(desc(customFieldDefinitions.createdAt)),
    db.select().from(customObjectDefinitions).orderBy(desc(customObjectDefinitions.createdAt)),
    db.select().from(tags).orderBy(desc(tags.createdAt)),
  ])
  return { permissions: perms, customFields, customObjects, tags: allTags }
}

export async function setFieldPermissionAction(data: {
  entityType: string
  fieldName: string
  role: "admin" | "member" | "guest"
  canRead: boolean
  canWrite: boolean
}) {
  const res = await setFieldPermission(data)
  revalidatePath("/settings")
  return res
}

export async function createTagAction(name: string, color?: string) {
  const [created] = await db
    .insert(tags)
    .values({ name, color: color || "#6366f1" })
    .returning()
  revalidatePath("/settings")
  return created
}

export async function createCustomFieldAction(data: {
  targetEntity: string
  name: string
  label: string
  fieldType: "TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "SELECT" | "MULTI_SELECT"
}) {
  const [created] = await db
    .insert(customFieldDefinitions)
    .values({
      targetEntity: data.targetEntity,
      name: data.name,
      label: data.label,
      fieldType: data.fieldType,
      isSearchable: true,
    })
    .returning()
  revalidatePath("/settings")
  return created
}

// ============================================================================
// DASHBOARD DATA
// ============================================================================

export async function getDashboardData() {
  const funnel = await getPipelineFunnelReport()
  const brandSummary = await getBrandPipelineSummary()
  const brandsList = await listBrands(true)
  const stages = await listPipelineStages()

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
    stages,
  }
}
