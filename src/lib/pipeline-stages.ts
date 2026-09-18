import { db } from '../db';
import {
  stageCategories,
  pipelineStages,
  pipelineTemplates,
  pipelineTemplateStages,
  opportunities,
} from '../db/schema';
import { eq, asc, sql } from 'drizzle-orm';

// ============================================================================
// STAGE CATEGORIES
// ============================================================================

export interface CreateStageCategoryInput {
  key: string;
  label: string;
  color?: string;
  isWon?: boolean;
  isLost?: boolean;
  isClosed?: boolean;
  sortOrder?: number;
}

export async function listStageCategories() {
  return await db.query.stageCategories.findMany({
    orderBy: [asc(stageCategories.sortOrder), asc(stageCategories.label)],
  });
}

export async function createStageCategory(input: CreateStageCategoryInput) {
  const key = input.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const isClosed = input.isClosed ?? Boolean(input.isWon || input.isLost);

  const [created] = await db
    .insert(stageCategories)
    .values({
      key,
      label: input.label,
      color: input.color ?? 'gray',
      isWon: input.isWon ?? false,
      isLost: input.isLost ?? false,
      isClosed,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();

  return created;
}

export async function updateStageCategory(
  id: string,
  patch: Partial<Pick<CreateStageCategoryInput, 'label' | 'color' | 'isWon' | 'isLost' | 'isClosed' | 'sortOrder'>>
) {
  const [updated] = await db
    .update(stageCategories)
    .set({
      ...patch,
      isClosed: patch.isClosed ?? (patch.isWon || patch.isLost ? true : undefined),
      updatedAt: new Date(),
    })
    .where(eq(stageCategories.id, id))
    .returning();

  return updated;
}

export async function deleteStageCategory(id: string) {
  const category = await db.query.stageCategories.findFirst({ where: eq(stageCategories.id, id) });
  if (!category) throw new Error('Stage category not found');
  if (category.isSystem) throw new Error('Cannot delete a built-in stage category');

  const stagesInUse = await db.query.pipelineStages.findFirst({ where: eq(pipelineStages.categoryId, id) });
  if (stagesInUse) throw new Error('Cannot delete a category that still has pipeline stages assigned to it');

  await db.delete(stageCategories).where(eq(stageCategories.id, id));
  return { success: true };
}

// ============================================================================
// PIPELINE STAGES
// ============================================================================

export interface CreatePipelineStageInput {
  key?: string;
  label: string;
  color?: string;
  categoryId: string;
  sortOrder?: number;
}

export async function listPipelineStages() {
  return await db.query.pipelineStages.findMany({
    orderBy: [asc(pipelineStages.sortOrder), asc(pipelineStages.label)],
    with: { category: true },
  });
}

export async function createPipelineStage(input: CreatePipelineStageInput) {
  const key = (input.key ?? input.label)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!key) throw new Error('A pipeline stage needs a non-empty label or key');

  const existing = await db.query.pipelineStages.findFirst({ where: eq(pipelineStages.key, key) });
  if (existing) throw new Error(`A stage with key "${key}" already exists`);

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${pipelineStages.sortOrder}), -1)` })
      .from(pipelineStages);
    sortOrder = Number(max) + 1;
  }

  const [created] = await db
    .insert(pipelineStages)
    .values({
      key,
      label: input.label,
      color: input.color ?? 'gray',
      categoryId: input.categoryId,
      sortOrder,
    })
    .returning();

  return created;
}

export async function updatePipelineStage(
  id: string,
  patch: Partial<Pick<CreatePipelineStageInput, 'label' | 'color' | 'categoryId' | 'sortOrder'>>
) {
  const [updated] = await db
    .update(pipelineStages)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(pipelineStages.id, id))
    .returning();

  return updated;
}

export async function reorderPipelineStages(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(pipelineStages).set({ sortOrder: index, updatedAt: new Date() }).where(eq(pipelineStages.id, id))
    )
  );
  return { success: true };
}

export async function deletePipelineStage(id: string) {
  const stage = await db.query.pipelineStages.findFirst({ where: eq(pipelineStages.id, id) });
  if (!stage) throw new Error('Pipeline stage not found');
  if (stage.isSystem) throw new Error('Cannot delete a built-in pipeline stage');

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(opportunities)
    .where(eq(opportunities.stage, stage.key));

  if (Number(count) > 0) {
    throw new Error(
      `Cannot delete stage "${stage.label}" — ${count} opportunit${Number(count) === 1 ? 'y is' : 'ies are'} currently in it. Move them to another stage first.`
    );
  }

  await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
  return { success: true };
}

/**
 * Resolve a stage key to its category flags, used by the MCP human-in-the-loop
 * gate to decide whether a stage change into a closed (won or lost) bucket
 * needs approval — generalizes beyond the two hardcoded CLOSED_WON/CLOSED_LOST keys.
 */
export async function getStageCategoryFlags(stageKey: string) {
  const stage = await db.query.pipelineStages.findFirst({
    where: eq(pipelineStages.key, stageKey),
    with: { category: true },
  });
  if (!stage) return { isClosed: false, isWon: false, isLost: false };
  return {
    isClosed: stage.category.isClosed,
    isWon: stage.category.isWon,
    isLost: stage.category.isLost,
  };
}

// ============================================================================
// PIPELINE TEMPLATES
// ============================================================================

export async function listPipelineTemplates() {
  return await db.query.pipelineTemplates.findMany({
    orderBy: [asc(pipelineTemplates.name)],
    with: { stages: { orderBy: [asc(pipelineTemplateStages.sortOrder)] } },
  });
}

/**
 * Snapshot the current board's stages into a brand new, fully custom
 * template — the counterpart to `applyPipelineTemplate`. Lets a workspace
 * that hand-built a pipeline save it for reuse (e.g. across a re-import,
 * a new brand, or just for documentation) without hardcoding it in code.
 */
export async function saveCurrentPipelineAsTemplate(input: { name: string; description?: string }) {
  const key = input.name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!key) throw new Error('Template needs a non-empty name');

  const existing = await db.query.pipelineTemplates.findFirst({ where: eq(pipelineTemplates.key, key) });
  if (existing) throw new Error(`A template named "${input.name}" already exists`);

  const currentStages = await listPipelineStages();
  if (currentStages.length === 0) throw new Error('No pipeline stages exist yet to snapshot');

  const [template] = await db
    .insert(pipelineTemplates)
    .values({ key, name: input.name, description: input.description, isBuiltin: false })
    .returning();

  for (const stage of currentStages) {
    await db.insert(pipelineTemplateStages).values({
      templateId: template.id,
      key: stage.key,
      label: stage.label,
      color: stage.color,
      sortOrder: stage.sortOrder,
      categoryKey: stage.category.key,
    });
  }

  return { ...template, stageCount: currentStages.length };
}

/**
 * Apply a template onto the current board: any template stage whose key does
 * not already exist as a pipeline stage is created (creating its category
 * first if that category key doesn't exist yet either). Existing stages are
 * left untouched — applying a template is additive, never destructive,
 * since deleting a stage that already holds opportunities is unsafe.
 */
export async function applyPipelineTemplate(templateId: string) {
  const template = await db.query.pipelineTemplates.findFirst({
    where: eq(pipelineTemplates.id, templateId),
    with: { stages: { orderBy: [asc(pipelineTemplateStages.sortOrder)] } },
  });
  if (!template) throw new Error('Pipeline template not found');

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${pipelineStages.sortOrder}), -1)` })
    .from(pipelineStages);
  let nextSortOrder = Number(max) + 1;

  const created: string[] = [];
  const skipped: string[] = [];

  for (const templateStage of template.stages) {
    const existingStage = await db.query.pipelineStages.findFirst({
      where: eq(pipelineStages.key, templateStage.key),
    });
    if (existingStage) {
      skipped.push(templateStage.label);
      continue;
    }

    let category = await db.query.stageCategories.findFirst({
      where: eq(stageCategories.key, templateStage.categoryKey),
    });
    if (!category) {
      category = await createStageCategory({
        key: templateStage.categoryKey,
        label: templateStage.categoryKey.charAt(0) + templateStage.categoryKey.slice(1).toLowerCase(),
        isWon: templateStage.categoryKey === 'WON',
        isLost: templateStage.categoryKey === 'LOST',
      });
    }

    await db.insert(pipelineStages).values({
      key: templateStage.key,
      label: templateStage.label,
      color: templateStage.color,
      categoryId: category.id,
      sortOrder: nextSortOrder++,
    });
    created.push(templateStage.label);
  }

  return { templateName: template.name, created, skipped };
}
