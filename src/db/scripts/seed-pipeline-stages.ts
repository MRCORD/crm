/**
 * Seed the default pipeline stage categories, stages, and built-in templates.
 * Safe to re-run — skips categories/stages/templates that already exist by key.
 *
 * Usage: pnpm tsx src/db/scripts/seed-pipeline-stages.ts
 */
import 'dotenv/config';
import { db } from '../index';
import { stageCategories, pipelineStages, pipelineTemplates, pipelineTemplateStages } from '../schema';
import { eq } from 'drizzle-orm';

const CATEGORIES = [
  { key: 'OPEN', label: 'Open', color: 'blue', isWon: false, isLost: false, isClosed: false, isSystem: true, sortOrder: 0 },
  { key: 'WON', label: 'Won', color: 'emerald', isWon: true, isLost: false, isClosed: true, isSystem: true, sortOrder: 1 },
  { key: 'LOST', label: 'Lost', color: 'rose', isWon: false, isLost: true, isClosed: true, isSystem: true, sortOrder: 2 },
];

// The current hardcoded 5-stage board becomes the seeded "Standard Sales" system default.
const STAGES = [
  { key: 'DISCOVERY', label: 'Discovery', color: 'blue', categoryKey: 'OPEN', sortOrder: 0, isSystem: true },
  { key: 'PROPOSAL', label: 'Proposal', color: 'purple', categoryKey: 'OPEN', sortOrder: 1, isSystem: true },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'amber', categoryKey: 'OPEN', sortOrder: 2, isSystem: true },
  { key: 'CLOSED_WON', label: 'Closed Won', color: 'emerald', categoryKey: 'WON', sortOrder: 3, isSystem: true },
  { key: 'CLOSED_LOST', label: 'Closed Lost', color: 'rose', categoryKey: 'LOST', sortOrder: 4, isSystem: true },
];

const TEMPLATES = [
  {
    key: 'STANDARD_SALES',
    name: 'Standard Sales',
    description: 'The default 5-stage pipeline: Discovery, Proposal, Negotiation, Closed Won, Closed Lost.',
    isBuiltin: true,
    stages: STAGES,
  },
  {
    key: 'SAAS_SUBSCRIPTION',
    name: 'SaaS Subscription',
    description: 'Product-led SaaS motion with a trial step before contract.',
    isBuiltin: true,
    stages: [
      { key: 'LEAD', label: 'Lead', color: 'sky', categoryKey: 'OPEN', sortOrder: 0 },
      { key: 'DEMO_SCHEDULED', label: 'Demo Scheduled', color: 'blue', categoryKey: 'OPEN', sortOrder: 1 },
      { key: 'TRIAL', label: 'Trial', color: 'indigo', categoryKey: 'OPEN', sortOrder: 2 },
      { key: 'CONTRACT_SENT', label: 'Contract Sent', color: 'amber', categoryKey: 'OPEN', sortOrder: 3 },
      { key: 'CLOSED_WON', label: 'Closed Won', color: 'emerald', categoryKey: 'WON', sortOrder: 4 },
      { key: 'CLOSED_LOST', label: 'Closed Lost', color: 'rose', categoryKey: 'LOST', sortOrder: 5 },
    ],
  },
  {
    key: 'ENTERPRISE_COMPLEX_SALE',
    name: 'Enterprise / Complex Sale',
    description: 'Longer-cycle enterprise motion with procurement and legal review steps.',
    isBuiltin: true,
    stages: [
      { key: 'QUALIFICATION', label: 'Qualification', color: 'sky', categoryKey: 'OPEN', sortOrder: 0 },
      { key: 'NEEDS_ANALYSIS', label: 'Needs Analysis', color: 'blue', categoryKey: 'OPEN', sortOrder: 1 },
      { key: 'SOLUTION_DESIGN', label: 'Solution Design', color: 'indigo', categoryKey: 'OPEN', sortOrder: 2 },
      { key: 'PROCUREMENT', label: 'Procurement', color: 'purple', categoryKey: 'OPEN', sortOrder: 3 },
      { key: 'LEGAL_REVIEW', label: 'Legal Review', color: 'amber', categoryKey: 'OPEN', sortOrder: 4 },
      { key: 'CLOSED_WON', label: 'Closed Won', color: 'emerald', categoryKey: 'WON', sortOrder: 5 },
      { key: 'CLOSED_LOST', label: 'Closed Lost', color: 'rose', categoryKey: 'LOST', sortOrder: 6 },
    ],
  },
];

async function main() {
  console.log('[Pipeline Stages] Seeding default categories, stages, and templates...\n');

  const categoryIdByKey = new Map<string, string>();
  for (const c of CATEGORIES) {
    const existing = await db.query.stageCategories.findFirst({ where: eq(stageCategories.key, c.key) });
    if (existing) {
      console.log(`  ⏭  Category ${c.label} (${c.key}) already exists — skipped`);
      categoryIdByKey.set(c.key, existing.id);
      continue;
    }
    const [created] = await db.insert(stageCategories).values(c).returning();
    categoryIdByKey.set(c.key, created.id);
    console.log(`  ✅ Created category: ${created.label} (${created.key})`);
  }

  for (const s of STAGES) {
    const existing = await db.query.pipelineStages.findFirst({ where: eq(pipelineStages.key, s.key) });
    if (existing) {
      console.log(`  ⏭  Stage ${s.label} (${s.key}) already exists — skipped`);
      continue;
    }
    const categoryId = categoryIdByKey.get(s.categoryKey)!;
    const [created] = await db
      .insert(pipelineStages)
      .values({
        key: s.key,
        label: s.label,
        color: s.color,
        categoryId,
        sortOrder: s.sortOrder,
        isSystem: s.isSystem,
      })
      .returning();
    console.log(`  ✅ Created stage: ${created.label} (${created.key})`);
  }

  for (const t of TEMPLATES) {
    const existing = await db.query.pipelineTemplates.findFirst({ where: eq(pipelineTemplates.key, t.key) });
    if (existing) {
      console.log(`  ⏭  Template ${t.name} already exists — skipped`);
      continue;
    }
    const [createdTemplate] = await db
      .insert(pipelineTemplates)
      .values({ key: t.key, name: t.name, description: t.description, isBuiltin: t.isBuiltin })
      .returning();
    for (const s of t.stages) {
      await db.insert(pipelineTemplateStages).values({
        templateId: createdTemplate.id,
        key: s.key,
        label: s.label,
        color: s.color,
        sortOrder: s.sortOrder,
        categoryKey: s.categoryKey,
      });
    }
    console.log(`  ✅ Created template: ${createdTemplate.name} (${t.stages.length} stages)`);
  }

  console.log('\n[Pipeline Stages] Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Pipeline Stages] Error:', err);
  process.exit(1);
});
