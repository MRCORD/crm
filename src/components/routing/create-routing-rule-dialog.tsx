"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createRoutingRuleAction } from "@/actions/crm"
import { AssignmentStrategy } from "@/lib/routing"
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
import { PlusIcon, Loader2Icon } from "lucide-react"

export function CreateRoutingRuleDialog() {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [targetEntity, setTargetEntity] = React.useState<"companies" | "people" | "opportunities">("companies")
  const [strategy, setStrategy] = React.useState<AssignmentStrategy>("ROUND_ROBIN")
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const priority = parseInt(formData.get("priority") as string) || 100
    const userIdsStr = formData.get("assignees") as string
    const assigneeUserIds = userIdsStr.split(",").map((s) => s.trim()).filter(Boolean)

    if (assigneeUserIds.length === 0) {
      setError("Please provide at least one assignee user ID")
      setLoading(false)
      return
    }

    try {
      await createRoutingRuleAction({
        name,
        targetEntity,
        strategy,
        assigneeUserIds,
        priority,
      })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || "Failed to create rule")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon className="mr-1 size-4" />
            Add Rule
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Assignment Rule</DialogTitle>
            <DialogDescription>
              Define routing criteria and assignment distribution.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="rule-name">Rule Name *</Label>
              <Input id="rule-name" name="name" required placeholder="e.g. Enterprise Inbound Round Robin" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Target Entity</Label>
                <Select
                  value={targetEntity}
                  onValueChange={(val) => setTargetEntity((val as any) ?? "companies")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="companies">Companies</SelectItem>
                    <SelectItem value="people">People</SelectItem>
                    <SelectItem value="opportunities">Opportunities</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Strategy</Label>
                <Select
                  value={strategy}
                  onValueChange={(val) => setStrategy((val as AssignmentStrategy) ?? "ROUND_ROBIN")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                    <SelectItem value="LOAD_BALANCED">Load Balanced</SelectItem>
                    <SelectItem value="TERRITORY">Territory Based</SelectItem>
                    <SelectItem value="STATIC">Static User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assignees">Assignee User IDs (comma-separated) *</Label>
              <Input id="assignees" name="assignees" required placeholder="user_123, user_456" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">Priority (lower runs first)</Label>
              <Input id="priority" name="priority" type="number" defaultValue="100" />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2Icon className="mr-1 size-4 animate-spin" />}
              Create Rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
