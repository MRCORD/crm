"use client"

import * as React from "react"
import Link from "next/link"
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
  Building2Icon,
  GlobeIcon,
  ArrowUpDownIcon,
} from "lucide-react"

export interface CompanyRow {
  id: string
  name: string
  domainName: string | null
  industry: string | null
  annualRevenueAmountMicros: string | null
  annualRevenueCurrency: string | null
  dealCount: number
  totalPipelineMicros: string
  peopleCount: number
  createdAt: Date
}

type SortField = "name" | "domain" | "revenue" | "deals" | "pipeline" | "contacts" | "createdAt"
type SortOrder = "asc" | "desc"

export function CompaniesTable({
  companies,
}: {
  companies: CompanyRow[]
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
      setSortOrder(field === "name" || field === "domain" ? "asc" : "desc")
    }
  }

  const sortedCompanies = React.useMemo(() => {
    const list = [...companies]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name)
      } else if (sortField === "domain") {
        comparison = (a.domainName || "").localeCompare(b.domainName || "")
      } else if (sortField === "revenue") {
        const aRev = BigInt(a.annualRevenueAmountMicros || 0)
        const bRev = BigInt(b.annualRevenueAmountMicros || 0)
        comparison = aRev > bRev ? 1 : aRev < bRev ? -1 : 0
      } else if (sortField === "deals") {
        comparison = a.dealCount - b.dealCount
      } else if (sortField === "pipeline") {
        const aPipe = BigInt(a.totalPipelineMicros || 0)
        const bPipe = BigInt(b.totalPipelineMicros || 0)
        comparison = aPipe > bPipe ? 1 : aPipe < bPipe ? -1 : 0
      } else if (sortField === "contacts") {
        comparison = a.peopleCount - b.peopleCount
      } else if (sortField === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return list
  }, [companies, sortField, sortOrder])

  const totalItems = sortedCompanies.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedCompanies = React.useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedCompanies.slice(start, start + pageSize)
  }, [sortedCompanies, safePage, pageSize])

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
                  <span>Company Name</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[140px]"
                onClick={() => handleSort("domain")}
              >
                <div className="flex items-center gap-1">
                  <span>Domain</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead className="py-3 text-xs font-semibold min-w-[120px]">
                Industry
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-right hover:text-foreground min-w-[130px]"
                onClick={() => handleSort("revenue")}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Annual Revenue</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-center hover:text-foreground min-w-[80px]"
                onClick={() => handleSort("deals")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Deals</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-right hover:text-foreground min-w-[130px]"
                onClick={() => handleSort("pipeline")}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Pipeline</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-center hover:text-foreground min-w-[90px]"
                onClick={() => handleSort("contacts")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Contacts</span>
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
            {paginatedCompanies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Building2Icon className="size-8 text-muted-foreground/40" />
                    <span className="text-xs">No companies found.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedCompanies.map((company) => (
                <TableRow key={company.id} className="hover:bg-muted/35 transition-colors border-b border-border/40">
                  <TableCell className="font-medium py-3">
                    <Link
                      href={`/companies/${company.id}`}
                      className="flex items-center gap-2.5 text-foreground hover:underline"
                    >
                      <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                        <Building2Icon className="size-4" />
                      </div>
                      <span className="font-semibold text-xs">{company.name}</span>
                    </Link>
                  </TableCell>

                  <TableCell className="py-3">
                    {company.domainName ? (
                      <a
                        href={`https://${company.domainName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        <GlobeIcon className="size-3 shrink-0" />
                        <span className="truncate">{company.domainName}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>

                  <TableCell className="py-3">
                    {company.industry ? (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {company.industry}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right font-medium py-3 tabular-nums">
                    {company.annualRevenueAmountMicros
                      ? formatMicros(
                          company.annualRevenueAmountMicros,
                          company.annualRevenueCurrency || undefined
                        )
                      : "—"}
                  </TableCell>

                  <TableCell className="text-center py-3">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {company.dealCount}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right font-semibold py-3 tabular-nums">
                    {formatMicros(company.totalPipelineMicros)}
                  </TableCell>

                  <TableCell className="text-center py-3 text-muted-foreground tabular-nums">
                    {company.peopleCount}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground py-3 tabular-nums">
                    {formatDate(company.createdAt)}
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
        itemLabel="companies"
      />
    </div>
  )
}
