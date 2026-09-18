"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createCompanyAction } from "@/actions/crm"
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
import { PlusIcon, Loader2Icon } from "lucide-react"

export function CreateCompanyDialog() {
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
    const domainName = (formData.get("domainName") as string) || undefined
    const industry = (formData.get("industry") as string) || undefined
    const revenueDollars = formData.get("revenueDollars") as string
    const city = (formData.get("city") as string) || undefined
    const country = (formData.get("country") as string) || undefined

    const annualRevenueMicros = revenueDollars
      ? Math.round(parseFloat(revenueDollars) * 1_000_000)
      : undefined

    try {
      const created = await createCompanyAction({
        name,
        domainName,
        industry,
        annualRevenueMicros,
        addressCity: city,
        addressCountry: country,
      })
      setOpen(false)
      router.push(`/companies/${created.id}`)
    } catch (err: any) {
      setError(err?.message || "Failed to create company")
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
            Add Company
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Company</DialogTitle>
            <DialogDescription>
              Create a new client account or organization record.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Acme Health Corp"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="domainName">Domain</Label>
                <Input
                  id="domainName"
                  name="domainName"
                  placeholder="acmehealth.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  name="industry"
                  placeholder="Healthcare / SaaS"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="revenueDollars">Annual Revenue ($ USD)</Label>
              <Input
                id="revenueDollars"
                name="revenueDollars"
                type="number"
                step="1000"
                placeholder="1000000"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" placeholder="Miami" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" placeholder="United States" />
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
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
