"use client"

import * as React from "react"
import { createPipelineStageAction, createStageCategoryAction } from "@/actions/crm"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { STAGE_COLOR_OPTIONS, stageDotClass } from "@/lib/stage-colors"
import { PlusIcon, Loader2Icon } from "lucide-react"

export interface StageCategoryOption {
  id: string
  key: string
  label: string
}

export function AddStageDialog({
  categories,
}: {
  categories: StageCategoryOption[]
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [label, setLabel] = React.useState("")
  const [color, setColor] = React.useState(STAGE_COLOR_OPTIONS[0])
  const [categoryId, setCategoryId] = React.useState<string>(categories[0]?.id ?? "")
  const [newCategoryMode, setNewCategoryMode] = React.useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = React.useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!label.trim()) {
      setError("Stage name is required")
      return
    }
    if (!newCategoryMode && !categoryId) {
      setError("Choose a category, or create a new one")
      return
    }
    if (newCategoryMode && !newCategoryLabel.trim()) {
      setError("New category name is required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      let targetCategoryId = categoryId
      if (newCategoryMode) {
        const category = await createStageCategoryAction({
          key: newCategoryLabel,
          label: newCategoryLabel,
          color,
        })
        targetCategoryId = category.id
      }

      await createPipelineStageAction({
        label,
        color,
        categoryId: targetCategoryId,
      })

      setLabel("")
      setNewCategoryLabel("")
      setNewCategoryMode(false)
      setOpen(false)
    } catch (err: any) {
      setError(err?.message || "Failed to create stage")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="h-full min-h-32 w-72 shrink-0 flex-col gap-1 border-dashed text-muted-foreground"
          >
            <PlusIcon className="size-5" />
            <span className="text-xs font-medium">Add Stage</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Pipeline Stage</DialogTitle>
            <DialogDescription>
              Create a custom stage for the opportunities board.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="stage-label">Stage Name *</Label>
              <Input
                id="stage-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Demo Scheduled"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {STAGE_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-6 rounded-full ${stageDotClass(c)} ${
                      color === c ? "ring-2 ring-offset-2 ring-ring" : ""
                    }`}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Category</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setNewCategoryMode((v) => !v)}
                >
                  {newCategoryMode ? "Choose existing" : "+ New category"}
                </button>
              </div>
              {newCategoryMode ? (
                <Input
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  placeholder="e.g. On Hold, Nurturing"
                />
              ) : (
                <Select value={categoryId} onValueChange={(val) => setCategoryId(val ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category...">
                      {(val: string) => categories.find((c) => c.id === val)?.label ?? "Select category..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-muted-foreground">
                Category determines whether deals in this stage count toward active
                pipeline, win rate, or trigger the agent approval gate.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2Icon className="mr-1 size-4 animate-spin" />}
              Add Stage
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
