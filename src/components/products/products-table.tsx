"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TablePagination } from "@/components/ui/table-pagination"
import { formatMicros, formatDate } from "@/lib/utils"
import {
  PackageIcon,
  ArrowUpDownIcon,
} from "lucide-react"

export interface ProductRow {
  id: string
  name: string
  sku: string | null
  description: string | null
  defaultPriceMicros: string
  currency: string
  isActive: boolean
  brandId: string | null
  brandName: string | null
  brandColor: string | null
  createdAt: Date
}

type SortField = "name" | "sku" | "brand" | "price" | "status" | "createdAt"
type SortOrder = "asc" | "desc"

export function ProductsTable({
  products,
}: {
  products: ProductRow[]
}) {
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [pageSize, setPageSize] = React.useState<number>(10)
  const [sortField, setSortField] = React.useState<SortField>("name")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc")

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder(field === "price" ? "desc" : "asc")
    }
  }

  const sortedProducts = React.useMemo(() => {
    const list = [...products]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name)
      } else if (sortField === "sku") {
        comparison = (a.sku || "").localeCompare(b.sku || "")
      } else if (sortField === "brand") {
        comparison = (a.brandName || "").localeCompare(b.brandName || "")
      } else if (sortField === "price") {
        const aPrice = BigInt(a.defaultPriceMicros || 0)
        const bPrice = BigInt(b.defaultPriceMicros || 0)
        comparison = aPrice > bPrice ? 1 : aPrice < bPrice ? -1 : 0
      } else if (sortField === "status") {
        comparison = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)
      } else if (sortField === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return list
  }, [products, sortField, sortOrder])

  const totalItems = sortedProducts.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedProducts = React.useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedProducts.slice(start, start + pageSize)
  }, [sortedProducts, safePage, pageSize])

  return (
    <div className="w-full min-w-full rounded-xl border bg-card shadow-2xs overflow-hidden">
      <div className="w-full overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-muted/30 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[200px]"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  <span>Product Name</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[120px]"
                onClick={() => handleSort("sku")}
              >
                <div className="flex items-center gap-1">
                  <span>SKU</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[140px]"
                onClick={() => handleSort("brand")}
              >
                <div className="flex items-center gap-1">
                  <span>Brand</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead className="py-3 text-xs font-semibold min-w-[200px]">
                Description
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-right hover:text-foreground min-w-[120px]"
                onClick={() => handleSort("price")}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Default Price</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-center hover:text-foreground min-w-[90px]"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Status</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[110px]"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center gap-1">
                  <span>Created</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <PackageIcon className="size-8 text-muted-foreground/40" />
                    <span className="text-xs">No products found in catalog.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((prod) => (
                <TableRow key={prod.id} className="hover:bg-muted/35 transition-colors border-b border-border/40">
                  <TableCell className="font-medium py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                        <PackageIcon className="size-4" />
                      </div>
                      <span className="font-semibold text-xs text-foreground">{prod.name}</span>
                    </div>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-muted-foreground py-3">
                    {prod.sku || "—"}
                  </TableCell>

                  <TableCell className="py-3">
                    {prod.brandName ? (
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{
                          borderColor: prod.brandColor || undefined,
                          color: prod.brandColor || undefined,
                        }}
                      >
                        {prod.brandName}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">General</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate py-3">
                    {prod.description || "—"}
                  </TableCell>

                  <TableCell className="text-right font-semibold py-3 tabular-nums">
                    {formatMicros(prod.defaultPriceMicros, prod.currency)}
                  </TableCell>

                  <TableCell className="text-center py-3">
                    <Badge variant={prod.isActive ? "secondary" : "outline"} className="text-xs">
                      {prod.isActive ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground py-3 tabular-nums">
                    {formatDate(prod.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        totalItems={totalItems}
        currentPage={safePage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        itemLabel="products"
      />
    </div>
  )
}
