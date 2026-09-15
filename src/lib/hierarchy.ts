import { db } from '../db';
import { companies, opportunities, people } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { logTimelineActivity } from './timeline';

export interface HierarchyNode {
  id: string;
  name: string;
  domainName: string | null;
  industry: string | null;
  parentCompanyId: string | null;
  depth: number;
  subsidiaries: HierarchyNode[];
}

export interface CompanyHierarchyResult {
  currentCompany: {
    id: string;
    name: string;
    domainName: string | null;
    parentCompanyId: string | null;
  };
  rootCompany: {
    id: string;
    name: string;
    domainName: string | null;
  };
  ancestors: Array<{
    id: string;
    name: string;
    domainName: string | null;
    depth: number;
  }>;
  descendantTree: HierarchyNode[];
  allFamilyCompanyIds: string[];
  rollup: {
    totalFamilyEntities: number;
    totalContacts: number;
    totalOpenOpportunities: number;
    totalPipelineAmountMicros: string;
  };
}

/**
 * Get all ancestor company IDs up to the root parent using recursive SQL CTE.
 */
export async function getCompanyAncestors(companyId: string) {
  const result = await db.execute(sql`
    WITH RECURSIVE company_ancestors AS (
      SELECT id, name, domain_name, parent_company_id, 0 AS depth
      FROM crm.companies
      WHERE id = ${companyId}::uuid AND deleted_at IS NULL

      UNION ALL

      SELECT c.id, c.name, c.domain_name, c.parent_company_id, ca.depth + 1
      FROM crm.companies c
      INNER JOIN company_ancestors ca ON c.id = ca.parent_company_id
      WHERE c.deleted_at IS NULL
    )
    SELECT * FROM company_ancestors ORDER BY depth ASC;
  `);

  return (result as unknown) as Array<{
    id: string;
    name: string;
    domain_name: string | null;
    parent_company_id: string | null;
    depth: number;
  }>;
}

/**
 * Get all descendant subsidiaries using recursive SQL CTE.
 */
export async function getCompanyDescendants(companyId: string) {
  const result = await db.execute(sql`
    WITH RECURSIVE company_descendants AS (
      SELECT id, name, domain_name, industry, parent_company_id, 0 AS depth
      FROM crm.companies
      WHERE id = ${companyId}::uuid AND deleted_at IS NULL

      UNION ALL

      SELECT c.id, c.name, c.domain_name, c.industry, c.parent_company_id, cd.depth + 1
      FROM crm.companies c
      INNER JOIN company_descendants cd ON c.parent_company_id = cd.id
      WHERE c.deleted_at IS NULL
    )
    SELECT * FROM company_descendants ORDER BY depth ASC, name ASC;
  `);

  return (result as unknown) as Array<{
    id: string;
    name: string;
    domain_name: string | null;
    industry: string | null;
    parent_company_id: string | null;
    depth: number;
  }>;
}

/**
 * Check if setting parentId on companyId would create a cycle (e.g. A -> B -> A).
 */
export async function wouldCreateCycle(companyId: string, prospectiveParentId: string): Promise<boolean> {
  if (companyId === prospectiveParentId) return true;
  // If prospective parent is currently a descendant of companyId, it's a cycle!
  const descendants = await getCompanyDescendants(companyId);
  return descendants.some((d) => d.id === prospectiveParentId);
}

/**
 * Set or clear the parent company for a subsidiary.
 */
export async function setParentCompany(options: {
  companyId: string;
  parentCompanyId: string | null;
  userId?: string;
}) {
  const { companyId, parentCompanyId, userId } = options;

  if (parentCompanyId) {
    const isCycle = await wouldCreateCycle(companyId, parentCompanyId);
    if (isCycle) {
      throw new Error(`Cannot set parent: would create a circular hierarchy loop.`);
    }

    const parent = await db.query.companies.findFirst({ where: eq(companies.id, parentCompanyId) });
    if (!parent) {
      throw new Error(`Parent company with ID ${parentCompanyId} not found.`);
    }
  }

  const [updated] = await db
    .update(companies)
    .set({
      parentCompanyId,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId))
    .returning();

  if (!updated) {
    throw new Error(`Company with ID ${companyId} not found.`);
  }

  await logTimelineActivity({
    entityType: 'company',
    entityId: companyId,
    activityType: 'FIELD_UPDATED',
    actorSource: userId ? 'MANUAL' : 'AGENT',
    actorUserId: userId ?? null,
    actorName: userId ? 'CRM User' : 'CRM MCP Agent',
    properties: {
      field: 'parentCompanyId',
      parentCompanyId,
    },
  });

  return updated;
}

/**
 * Retrieve complete corporate hierarchy tree, ancestors, and consolidated pipeline rollup.
 */
export async function getCompanyHierarchy(companyId: string): Promise<CompanyHierarchyResult> {
  // 1. Traverse up to ancestors
  const ancestors = await getCompanyAncestors(companyId);
  if (ancestors.length === 0) {
    throw new Error(`Company with ID ${companyId} not found`);
  }

  const currentRaw = ancestors[0]!;
  const rootRaw = ancestors[ancestors.length - 1]!;

  // 2. Traverse down all descendants from the root to build the full family tree
  const allDescendants = await getCompanyDescendants(rootRaw.id);
  const allFamilyCompanyIds = allDescendants.map((d) => d.id);

  // 3. Build tree structure from root
  function buildSubTree(parentId: string | null, depth: number): HierarchyNode[] {
    return allDescendants
      .filter((d) => (d.parent_company_id === parentId) && d.id !== rootRaw.id)
      .map((d) => ({
        id: d.id,
        name: d.name,
        domainName: d.domain_name,
        industry: d.industry,
        parentCompanyId: d.parent_company_id,
        depth,
        subsidiaries: buildSubTree(d.id, depth + 1),
      }));
  }

  const descendantTree: HierarchyNode[] = [
    {
      id: rootRaw.id,
      name: rootRaw.name,
      domainName: rootRaw.domain_name,
      industry: null,
      parentCompanyId: null,
      depth: 0,
      subsidiaries: buildSubTree(rootRaw.id, 1),
    },
  ];

  // 4. Calculate consolidated family pipeline and contact rollup
  let totalContacts = 0;
  let totalOpenOpportunities = 0;
  let totalPipelineAmountMicros = '0';

  if (allFamilyCompanyIds.length > 0) {
    // Total contacts in family
    const contactCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(people)
      .where(and(inArray(people.companyId, allFamilyCompanyIds), sql`${people.deletedAt} IS NULL`));
    totalContacts = Number(contactCountRes[0]?.count ?? 0);

    // Total open pipeline in family
    const oppStatsRes = await db
      .select({
        count: sql<number>`count(*)`,
        sumMicros: sql<string>`coalesce(sum(amount_micros), 0)`,
      })
      .from(opportunities)
      .where(
        and(
          inArray(opportunities.companyId, allFamilyCompanyIds),
          sql`${opportunities.deletedAt} IS NULL`,
          sql`${opportunities.stage} NOT IN ('CLOSED_WON', 'CLOSED_LOST')`
        )
      );

    totalOpenOpportunities = Number(oppStatsRes[0]?.count ?? 0);
    totalPipelineAmountMicros = oppStatsRes[0]?.sumMicros ?? '0';
  }

  return {
    currentCompany: {
      id: currentRaw.id,
      name: currentRaw.name,
      domainName: currentRaw.domain_name,
      parentCompanyId: currentRaw.parent_company_id,
    },
    rootCompany: {
      id: rootRaw.id,
      name: rootRaw.name,
      domainName: rootRaw.domain_name,
    },
    ancestors: ancestors.slice(1).map((a) => ({
      id: a.id,
      name: a.name,
      domainName: a.domain_name,
      depth: a.depth,
    })),
    descendantTree,
    allFamilyCompanyIds,
    rollup: {
      totalFamilyEntities: allFamilyCompanyIds.length,
      totalContacts,
      totalOpenOpportunities,
      totalPipelineAmountMicros,
    },
  };
}
