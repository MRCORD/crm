"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createWebhookAction } from "@/actions/crm"
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

const CRM_EVENTS = [
  "company.created",
  "company.updated",
  "opportunity.created",
  "opportunity.stage_changed",
  "person.created",
  "quote.generated",
]

export function CreateWebhookDialog() {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>([
    "company.created",
    "opportunity.stage_changed",
  ])
  const router = useRouter()

  function toggleEvent(ev: string) {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedEvents.length === 0) {
      setError("Please select at least one event trigger")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const url = formData.get("url") as string
    const description = (formData.get("description") as string) || undefined

    try {
      await createWebhookAction({
        name: url.replace(/^https?:\/\//, "").slice(0, 30),
        targetUrl: url,
        eventTypes: selectedEvents,
        description,
      })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || "Failed to create webhook")
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
            Add Webhook
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Register Outbound Webhook</DialogTitle>
            <DialogDescription>
              Deliver real-time POST payloads on CRM lifecycle events.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="hook-url">Endpoint URL *</Label>
              <Input
                id="hook-url"
                name="url"
                type="url"
                required
                placeholder="https://api.yourcompany.com/webhooks/crm"
              />
            </div>

            <div className="grid gap-2">
              <Label>Subscribed Event Triggers *</Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                {CRM_EVENTS.map((ev) => (
                  <label
                    key={ev}
                    className="flex items-center gap-2 text-xs cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(ev)}
                      onChange={() => toggleEvent(ev)}
                      className="rounded"
                    />
                    <span className="font-mono">{ev}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hook-desc">Description</Label>
              <Textarea id="hook-desc" name="description" placeholder="Zapier sync or external reporting..." />
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
              Register Webhook
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
