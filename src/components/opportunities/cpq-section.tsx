"use client"

import * as React from "react"
import {
  addLineItemAction,
  removeLineItemAction,
  generateQuoteAction,
} from "@/actions/crm"
import { formatMicros, formatDate } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PlusIcon,
  Trash2Icon,
  FileTextIcon,
  Loader2Icon,
  PackageIcon,
} from "lucide-react"

interface LineItem {
  id: string
  productId: string
  productName: string
  productSku: string | null
  quantity: number
  unitPriceMicros: string
  discountPercent: string
  totalPriceMicros: string
}

interface Product {
  id: string
  name: string
  sku: string | null
  defaultPriceMicros: string
  currency: string
}

interface Quote {
  id: string
  quoteNumber: string
  status: string
  totalAmountMicros: string
  currency: string
  expiresAt: Date | null
  notes: string | null
  createdAt: Date
}

export function CpqSection({
  opportunityId,
  lineItems,
  quotes,
  products,
}: {
  opportunityId: string
  lineItems: LineItem[]
  quotes: Quote[]
  products: Product[]
}) {
  const [addOpen, setAddOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [quoteLoading, setQuoteLoading] = React.useState(false)
  const [selectedProductId, setSelectedProductId] = React.useState<string>("")
  const [quantity, setQuantity] = React.useState<number>(1)
  const [discount, setDiscount] = React.useState<number>(0)

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  async function handleAddLineItem(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProductId) return

    setLoading(true)
    try {
      await addLineItemAction({
        opportunityId,
        productId: selectedProductId,
        quantity,
        unitPriceMicros: selectedProduct
          ? Number(selectedProduct.defaultPriceMicros)
          : undefined,
        discountPercent: discount,
      })
      setAddOpen(false)
      setSelectedProductId("")
      setQuantity(1)
      setDiscount(0)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveLineItem(id: string) {
    await removeLineItemAction(id, opportunityId)
  }

  async function handleGenerateQuote() {
    setQuoteLoading(true)
    try {
      await generateQuoteAction(opportunityId, "Generated via CRM CPQ")
    } finally {
      setQuoteLoading(false)
    }
  }

  const grandTotalMicros = lineItems.reduce(
    (sum, item) => sum + BigInt(item.totalPriceMicros || 0),
    BigInt(0)
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Line Items Table Card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b">
          <div>
            <h3 className="text-base font-semibold">Configured Line Items</h3>
            <p className="text-xs text-muted-foreground">
              Products, volume, and pricing configured for this deal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger
                render={
                  <Button size="sm" variant="outline">
                    <PlusIcon className="mr-1 size-4" />
                    Add Product
                  </Button>
                }
              />
              <DialogContent>
                <form onSubmit={handleAddLineItem}>
                  <DialogHeader>
                    <DialogTitle>Add Line Item</DialogTitle>
                    <DialogDescription>
                      Select a product from the catalog to attach to this deal.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Product *</Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={(val) => setSelectedProductId(val ?? "")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a catalog product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}{" "}
                              {p.sku ? `(${p.sku})` : ""} —{" "}
                              {formatMicros(p.defaultPriceMicros, p.currency)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="qty">Quantity</Label>
                        <Input
                          id="qty"
                          type="number"
                          value={quantity}
                          onChange={(e) =>
                            setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="discount">Discount %</Label>
                        <Input
                          id="discount"
                          type="number"
                          min="0"
                          value={discount}
                          onChange={(e) =>
                            setDiscount(
                              Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || !selectedProductId}
                    >
                      {loading && (
                        <Loader2Icon className="mr-1 size-4 animate-spin" />
                      )}
                      Add to Deal
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              onClick={handleGenerateQuote}
              disabled={lineItems.length === 0 || quoteLoading}
            >
              {quoteLoading ? (
                <Loader2Icon className="mr-1 size-4 animate-spin" />
              ) : (
                <FileTextIcon className="mr-1 size-4" />
              )}
              Generate Quote
            </Button>
          </div>
        </div>

        {lineItems.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <PackageIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
            <span>No line items added yet. Click &quot;Add Product&quot; to configure pricing.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-center">Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.productSku || "—"}
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatMicros(item.unitPriceMicros)}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {parseFloat(item.discountPercent) > 0
                        ? `${parseFloat(item.discountPercent)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMicros(item.totalPriceMicros)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveLineItem(item.id)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell colSpan={5} className="text-right">
                    Grand Total
                  </TableCell>
                  <TableCell className="text-right text-base font-bold">
                    {formatMicros(grandTotalMicros.toString())}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Generated Quotes Card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="pb-4 border-b">
          <h3 className="text-base font-semibold">Formal Quotes</h3>
          <p className="text-xs text-muted-foreground">
            Timestamped quote snapshots with lock-in expiration dates
          </p>
        </div>

        {quotes.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No formal quotes generated for this deal yet. Click &quot;Generate Quote&quot;
            above once line items are configured.
          </p>
        ) : (
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs font-semibold">
                    {q.quoteNumber}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMicros(q.totalAmountMicros, q.currency)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(q.expiresAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(q.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
