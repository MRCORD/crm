"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createBrandAction } from "@/actions/crm"
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

export function CreateBrandDialog() {
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
    const slug = formData.get("slug") as string
    const description = (formData.get("description") as string) || undefined
    const color = (formData.get("color") as string) || undefined

    try {
      await createBrandAction({ name, slug, description, color })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || "Failed to create brand")
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
            Add Brand
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Brand / DBA</DialogTitle>
            <DialogDescription>
              Register a subsidiary operating brand under Mysios Labs.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="brand-name">Brand Name *</Label>
                <Input id="brand-name" name="name" required placeholder="Habladoc" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brand-slug">Slug *</Label>
                <Input id="brand-slug" name="slug" required placeholder="habladoc" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand-color">Brand Accent Color</Label>
              <Input id="brand-color" name="color" type="color" defaultValue="#06b6d4" className="h-10 cursor-pointer p-1" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand-desc">Description</Label>
              <Textarea id="brand-desc" name="description" placeholder="Telehealth and clinical workflow platform" />
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
              Create Brand
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
