/**
 * Shared color palette for pipeline stages and stage categories.
 * Stages/categories store a semantic color word (e.g. "blue", "emerald") in
 * the database; these lookups turn that into Tailwind classes. Kept as a
 * fixed literal-class map (not string interpolation) because Tailwind's JIT
 * scanner only picks up classes it can see written out in source.
 */
export const STAGE_BADGE_CLASSES: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
}

export const STAGE_BORDER_CLASSES: Record<string, string> = {
  blue: "border-t-blue-500",
  purple: "border-t-purple-500",
  amber: "border-t-amber-500",
  emerald: "border-t-emerald-500",
  rose: "border-t-rose-500",
  sky: "border-t-sky-500",
  indigo: "border-t-indigo-500",
  gray: "border-t-gray-500",
}

export const STAGE_DOT_CLASSES: Record<string, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  indigo: "bg-indigo-500",
  gray: "bg-gray-500",
}

export const STAGE_SOLID_CLASSES: Record<string, string> = {
  blue: "bg-blue-600 hover:bg-blue-700 text-white",
  purple: "bg-purple-600 hover:bg-purple-700 text-white",
  amber: "bg-amber-600 hover:bg-amber-700 text-white",
  emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
  rose: "bg-rose-600 hover:bg-rose-700 text-white",
  sky: "bg-sky-600 hover:bg-sky-700 text-white",
  indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
  gray: "bg-gray-600 hover:bg-gray-700 text-white",
}

export const STAGE_COLOR_OPTIONS = Object.keys(STAGE_BADGE_CLASSES)

export function stageBadgeClass(color: string | undefined | null) {
  return STAGE_BADGE_CLASSES[color ?? "gray"] ?? STAGE_BADGE_CLASSES.gray
}

export function stageBorderClass(color: string | undefined | null) {
  return STAGE_BORDER_CLASSES[color ?? "gray"] ?? STAGE_BORDER_CLASSES.gray
}

export function stageDotClass(color: string | undefined | null) {
  return STAGE_DOT_CLASSES[color ?? "gray"] ?? STAGE_DOT_CLASSES.gray
}

export function stageSolidClass(color: string | undefined | null) {
  return STAGE_SOLID_CLASSES[color ?? "gray"] ?? STAGE_SOLID_CLASSES.gray
}

export interface StageInfo {
  id: string
  key: string
  label: string
  color: string
  sortOrder: number
  categoryId: string
  category: {
    id: string
    key: string
    label: string
    color: string
    isWon: boolean
    isLost: boolean
    isClosed: boolean
  }
}

export function buildStageMap(stages: StageInfo[]) {
  return new Map(stages.map((s) => [s.key, s]))
}
