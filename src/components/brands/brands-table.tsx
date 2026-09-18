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
import { formatDate } from "@/lib/utils"
import {
  BadgeCheckIcon,
  GlobeIcon,
  ArrowUpDownIcon,
} from "lucide-react"

export interface BrandRow {
  id: string
  name: string
  slug: string
  description: string | null
  website: string | null
  logoUrl: string | null
  color: string | null
  isActive: boolean
  createdAt: Date
}

type SortField = "name" | "slug" | "website" | "status" | "createdAt"
type SortOrder = "asc" | "desc"

export function BrandsTable({
  brands,
}: {
  brands: BrandRow[]
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
      setSortOrder("asc")
    }
  }

  const sortedBrands = React.useMemo(() => {
    const list = [...brands]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name)
      } else if (sortField === "slug") {
        comparison = a.slug.localeCompare(b.slug)
      } else if (sortField === "website") {
        comparison = (a.website || "").localeCompare(b.website || "")
      } else if (sortField === "status") {
        comparison = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)
      } else if (sortField === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return list
  }, [brands, sortField, sortOrder])

  const totalItems = sortedBrands.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const paginatedBrands = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedBrands.slice(start, start + pageSize)
  }, [sortedBrands, currentPage, pageSize])

  return (
    <div className="w-full min-w-full rounded-xl border bg-card shadow-2xs overflow-hidden">
      <div className="w-full overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-muted/30 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[180px]"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  <span>Brand Name</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[120px]"
                onClick={() => handleSort("slug")}
              >
                <div className="flex items-center gap-1">
                  <span>Slug</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[160px]"
                onClick={() => handleSort("website")}
              >
                <div className="flex items-center gap-1">
                  <span>Website</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead className="py-3 text-xs font-semibold min-w-[200px]">
                Description
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
            {paginatedBrands.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <BadgeCheckIcon className="size-8 text-muted-foreground/40" />
                    <span className="text-xs">No brands found.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedBrands.map((brand) => (
                <TableRow key={brand.id} className="hover:bg-muted/35 transition-colors border-b border-border/40">
                  <TableCell className="font-medium py-3">
                    <div className="flex items-center gap-2">
                      {brand.color && (
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: brand.color }}
                        />
                      )}
                      <span className="font-semibold text-xs text-foreground">{brand.name}</span>
                    </div>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-muted-foreground py-3">
                    {brand.slug}
                  </TableCell>

                  <TableCell className="py-3">
                    {brand.website ? (
                      <a
                        href={brand.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        <GlobeIcon className="size-3 shrink-0" />
                        <span className="truncate">{brand.website}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate py-3">
                    {brand.description || "—"}
                  </TableCell>

                  <TableCell className="text-center py-3">
                    <Badge
                      variant={brand.isActive ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {brand.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground py-3 tabular-nums">
                    {formatDate(brand.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        totalItems={totalItems}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        itemLabel="brands"
      />
    </div>
  )
}
