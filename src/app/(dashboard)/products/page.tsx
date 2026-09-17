import { getProductsAction } from "@/actions/crm"
import { formatMicros, formatDate } from "@/lib/utils"
import { CreateProductDialog } from "@/components/products/create-product-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PackageIcon } from "lucide-react"

export default async function ProductsPage() {
  const productList = await getProductsAction()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products &amp; Services</h1>
          <p className="text-sm text-muted-foreground">
            Catalog items, SKUs, and default pricing for CPQ line item quoting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateProductDialog />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Default Price</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <PackageIcon className="size-8 text-muted-foreground/50" />
                    <span>No products found in catalog.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              productList.map((prod) => (
                <TableRow key={prod.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <PackageIcon className="size-4" />
                      </div>
                      <span>{prod.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {prod.sku || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {prod.description || "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMicros(prod.defaultPriceMicros, prod.currency)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={prod.isActive ? "secondary" : "outline"} className="text-xs">
                      {prod.isActive ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(prod.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
