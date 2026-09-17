"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createOpportunityAction, OpportunityStage } from "@/actions/crm"
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

export function CreateOpportunityDialog({
  companies,
  brands,
  stages,
}: {
  companies: { id: string; name: string }[]
  brands: { id: string; name: string }[]
  stages: { key: string; label: string }[]
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [companyId, setCompanyId] = React.useState<string>("")
  const [brandId, setBrandId] = React.useState<string>("")
  const [stage, setStage] = React.useState<OpportunityStage>(stages[0]?.key ?? "DISCOVERY")
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!companyId) {
      setError("Please select a company")
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const amountDollars = formData.get("amountDollars") as string
    const closeDate = (formData.get("closeDate") as string) || undefined

    const amountMicros = amountDollars
      ? Math.round(parseFloat(amountDollars) * 1_000_000)
      : 0

    try {
      const created = await createOpportunityAction({
        name,
        companyId,
        amountMicros,
        stage,
        brandId: brandId || undefined,
        closeDate,
      })
      setOpen(false)
      router.push(`/opportunities/${created.id}`)
    } catch (err: any) {
      setError(err?.message || "Failed to create deal")
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
            New Deal
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Opportunity</DialogTitle>
            <DialogDescription>
              Add a new sales deal or pipeline opportunity.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="opp-name">Deal Name *</Label>
              <Input
                id="opp-name"
                name="name"
                placeholder="e.g. Enterprise License Expansion"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Company (Account) *</Label>
              <Select value={companyId} onValueChange={(val) => setCompanyId(val ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="amountDollars">Amount ($ USD)</Label>
                <Input
                  id="amountDollars"
                  name="amountDollars"
                  type="number"
                  step="500"
                  placeholder="50000"
                />
              </div>
              <div className="grid gap-2">
                <Label>Stage</Label>
                <Select
                  value={stage}
                  onValueChange={(val) => setStage((val as OpportunityStage) ?? "DISCOVERY")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Brand / DBA</Label>
                <Select value={brandId} onValueChange={(val) => setBrandId(val ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select DBA..." />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="closeDate">Target Close Date</Label>
                <Input id="closeDate" name="closeDate" type="date" />
              </div>
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
              Create Deal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
