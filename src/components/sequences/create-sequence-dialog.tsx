"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createSequenceAction } from "@/actions/crm"
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
import { Textarea } from "@/components/ui/textarea"
import { PlusIcon, Loader2Icon } from "lucide-react"

export function CreateSequenceDialog() {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const description = (formData.get("description") as string) || undefined

    try {
      await createSequenceAction({
        name,
        description,
        steps: [
          {
            stepOrder: 1,
            channel: "EMAIL",
            delayDays: 0,
            templateSubject: "Introduction from Mysios Labs",
            templateBody: "Hi {{firstName}}, wanted to reach out regarding...",
          },
          {
            stepOrder: 2,
            channel: "EMAIL",
            delayDays: 3,
            templateSubject: "Follow-up",
            templateBody: "Hi {{firstName}}, checking in on my previous email...",
          },
        ],
      })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || "Failed to create sequence")
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
            New Sequence
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Outbound Sequence</DialogTitle>
            <DialogDescription>
              Set up a multi-step automated email outreach cadence.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="seq-name">Sequence Name *</Label>
              <Input id="seq-name" name="name" required placeholder="e.g. Q4 Inbound Lead Follow-up" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="seq-desc">Description</Label>
              <Textarea id="seq-desc" name="description" placeholder="Target audience or purpose..." />
            </div>

            <p className="text-xs text-muted-foreground">
              Default 2-step email cadence will be created automatically. Steps can be edited later.
            </p>
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
              Create Sequence
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
