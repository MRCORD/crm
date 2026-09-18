"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createProductAction } from "@/actions/crm"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon, Loader2Icon } from "lucide-react"

export function CreateProductDialog({
  brands,
}: {
  brands: { id: string; name: string }[]
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [brandId, setBrandId] = React.useState<string>("")
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const sku = (formData.get("sku") as string) || undefined
    const description = (formData.get("description") as string) || undefined
    const priceStr = formData.get("priceDollars") as string

    try {
      await createProductAction({
        name,
        sku,
        description,
        defaultPriceDollars: parseFloat(priceStr) || 0,
        brandId: brandId || undefined,
      })
      setOpen(false)
      setBrandId("")
      router.refresh()
    } catch (err: any) {
      setError(err?.message || "Failed to create product")
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
            Add Product
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Catalog Product</DialogTitle>
            <DialogDescription>
              Create a new product or billable service SKU, optionally scoped to a brand/DBA.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="prod-name">Product Name *</Label>
              <Input id="prod-name" name="name" required placeholder="e.g. Enterprise License" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" name="sku" placeholder="ENT-LIC-01" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priceDollars">Default Price ($ USD) *</Label>
                <Input id="priceDollars" name="priceDollars" type="number" step="0.01" required placeholder="99.00" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Brand / DBA</Label>
              <Select value={brandId} onValueChange={(val) => setBrandId(val ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="General (no brand scope)" />
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
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" name="description" placeholder="Product details or SLA..." />
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
              Create Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
