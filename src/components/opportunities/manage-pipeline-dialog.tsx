"use client"

import * as React from "react"
import {
  createStageCategoryAction,
  deletePipelineStageAction,
  reorderPipelineStagesAction,
  applyPipelineTemplateAction,
  saveCurrentPipelineAsTemplateAction,
} from "@/actions/crm"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { STAGE_COLOR_OPTIONS, stageDotClass, stageBadgeClass } from "@/lib/stage-colors"
import {
  SettingsIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Loader2Icon,
  CheckIcon,
} from "lucide-react"

export interface ManageStage {
  id: string
  key: string
  label: string
  color: string
  sortOrder: number
  isSystem: boolean
  category: { id: string; key: string; label: string; color: string; isWon: boolean; isLost: boolean; isClosed: boolean }
}

export interface ManageCategory {
  id: string
  key: string
  label: string
  color: string
  isWon: boolean
  isLost: boolean
  isClosed: boolean
  isSystem: boolean
}

export interface ManageTemplate {
  id: string
  name: string
  description: string | null
  isBuiltin: boolean
  stages: { key: string; label: string; color: string; categoryKey: string }[]
}

export function ManagePipelineDialog({
  stages,
  categories,
  templates,
}: {
  stages: ManageStage[]
  categories: ManageCategory[]
  templates: ManageTemplate[]
}) {
  const [open, setOpen] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [templateResult, setTemplateResult] = React.useState<Record<string, string>>({})
  const [saveTemplateName, setSaveTemplateName] = React.useState("")
  const [savingTemplate, setSavingTemplate] = React.useState(false)
  const [saveTemplateMessage, setSaveTemplateMessage] = React.useState<string | null>(null)

  // New category form
  const [newCatLabel, setNewCatLabel] = React.useState("")
  const [newCatColor, setNewCatColor] = React.useState(STAGE_COLOR_OPTIONS[0])
  const [newCatIsWon, setNewCatIsWon] = React.useState(false)
  const [newCatIsLost, setNewCatIsLost] = React.useState(false)
  const [creatingCategory, setCreatingCategory] = React.useState(false)

  const sortedStages = [...stages].sort((a, b) => a.sortOrder - b.sortOrder)

  async function handleDeleteStage(stage: ManageStage) {
    setError(null)
    setBusyId(stage.id)
    try {
      await deletePipelineStageAction(stage.id)
    } catch (err: any) {
      setError(err?.message || "Failed to delete stage")
    } finally {
      setBusyId(null)
    }
  }

  async function handleMove(stage: ManageStage, direction: -1 | 1) {
    const idx = sortedStages.findIndex((s) => s.id === stage.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= sortedStages.length) return

    const reordered = [...sortedStages]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]

    setError(null)
    setBusyId(stage.id)
    try {
      await reorderPipelineStagesAction(reordered.map((s) => s.id))
    } catch (err: any) {
      setError(err?.message || "Failed to reorder stages")
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatLabel.trim()) return
    setCreatingCategory(true)
    setError(null)
    try {
      await createStageCategoryAction({
        key: newCatLabel,
        label: newCatLabel,
        color: newCatColor,
        isWon: newCatIsWon,
        isLost: newCatIsLost,
      })
      setNewCatLabel("")
      setNewCatIsWon(false)
      setNewCatIsLost(false)
    } catch (err: any) {
      setError(err?.message || "Failed to create category")
    } finally {
      setCreatingCategory(false)
    }
  }

  async function handleApplyTemplate(template: ManageTemplate) {
    setError(null)
    setBusyId(template.id)
    try {
      const result = await applyPipelineTemplateAction(template.id)
      const summary =
        result.created.length > 0
          ? `Added: ${result.created.join(", ")}`
          : "No new stages — all already on the board"
      setTemplateResult((prev) => ({ ...prev, [template.id]: summary }))
    } catch (err: any) {
      setError(err?.message || "Failed to apply template")
    } finally {
      setBusyId(null)
    }
  }

  async function handleSaveAsTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!saveTemplateName.trim()) return
    setSavingTemplate(true)
    setError(null)
    setSaveTemplateMessage(null)
    try {
      const result = await saveCurrentPipelineAsTemplateAction({ name: saveTemplateName })
      setSaveTemplateMessage(`Saved "${result.name}" with ${result.stageCount} stages`)
      setSaveTemplateName("")
    } catch (err: any) {
      setError(err?.message || "Failed to save template")
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <SettingsIcon className="mr-1 size-4" />
            Manage Stages
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Manage Pipeline</DialogTitle>
          <DialogDescription>
            Reorder or remove stages, define stage categories, and apply pipeline templates.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="stages" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stages">Stages</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          {/* STAGES */}
          <TabsContent value="stages" className="mt-4">
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {sortedStages.map((stage, idx) => (
                <div
                  key={stage.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${
                    busyId === stage.id ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`size-2.5 shrink-0 rounded-full ${stageDotClass(stage.color)}`} />
                    <span className="text-sm font-medium truncate">{stage.label}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {stage.category.label}
                    </Badge>
                    {stage.isSystem && (
                      <span className="text-[10px] text-muted-foreground shrink-0">built-in</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      disabled={idx === 0}
                      onClick={() => handleMove(stage, -1)}
                    >
                      <ArrowUpIcon className="size-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      disabled={idx === sortedStages.length - 1}
                      onClick={() => handleMove(stage, 1)}
                    >
                      <ArrowDownIcon className="size-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 text-destructive hover:text-destructive"
                      disabled={stage.isSystem}
                      title={stage.isSystem ? "Built-in stages can't be deleted" : "Delete stage"}
                      onClick={() => handleDeleteStage(stage)}
                    >
                      {busyId === stage.id ? (
                        <Loader2Icon className="size-3 animate-spin" />
                      ) : (
                        <TrashIcon className="size-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* CATEGORIES */}
          <TabsContent value="categories" className="mt-4">
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1 mb-4">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${stageDotClass(c.color)}`} />
                    <span className="text-sm font-medium">{c.label}</span>
                    {c.isSystem && <span className="text-[10px] text-muted-foreground">built-in</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {c.isWon && <Badge className={stageBadgeClass("emerald")}>Won</Badge>}
                    {c.isLost && <Badge className={stageBadgeClass("rose")}>Lost</Badge>}
                    {!c.isWon && !c.isLost && <Badge variant="outline">Open</Badge>}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateCategory} className="flex flex-col gap-3 rounded-lg border p-3">
              <Label className="text-xs">New Category</Label>
              <div className="flex gap-2">
                <Input
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="e.g. On Hold"
                  className="h-8"
                />
                <div className="flex items-center gap-1.5">
                  {STAGE_COLOR_OPTIONS.slice(0, 5).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCatColor(c)}
                      className={`size-5 rounded-full ${stageDotClass(c)} ${
                        newCatColor === c ? "ring-2 ring-offset-1 ring-ring" : ""
                      }`}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={newCatIsWon} onCheckedChange={(v) => setNewCatIsWon(Boolean(v))} />
                  Counts as Won
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={newCatIsLost} onCheckedChange={(v) => setNewCatIsLost(Boolean(v))} />
                  Counts as Lost
                </label>
                <Button type="submit" size="sm" className="ml-auto h-7" disabled={creatingCategory}>
                  {creatingCategory && <Loader2Icon className="mr-1 size-3 animate-spin" />}
                  Add Category
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TEMPLATES */}
          <TabsContent value="templates" className="mt-4">
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {templates.map((t) => (
                <div key={t.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold">{t.name}</span>
                      {t.isBuiltin && <span className="ml-2 text-[10px] text-muted-foreground">built-in</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      disabled={busyId === t.id}
                      onClick={() => handleApplyTemplate(t)}
                    >
                      {busyId === t.id ? (
                        <Loader2Icon className="mr-1 size-3 animate-spin" />
                      ) : (
                        <CheckIcon className="mr-1 size-3" />
                      )}
                      Apply
                    </Button>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {t.stages.map((s) => (
                      <Badge key={s.key} variant="outline" className="text-[10px]">
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                  {templateResult[t.id] && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">{templateResult[t.id]}</p>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleSaveAsTemplate} className="mt-4 flex flex-col gap-2 rounded-lg border p-3">
              <Label className="text-xs">Save Current Board as a New Template</Label>
              <div className="flex gap-2">
                <Input
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  placeholder="e.g. Q1 Enterprise Pipeline"
                  className="h-8"
                />
                <Button type="submit" size="sm" className="h-8 shrink-0" disabled={savingTemplate}>
                  {savingTemplate && <Loader2Icon className="mr-1 size-3 animate-spin" />}
                  Save as Template
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Snapshots every current stage (in order, with its category) into a reusable
                custom template — the counterpart to applying one above.
              </p>
              {saveTemplateMessage && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{saveTemplateMessage}</p>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
