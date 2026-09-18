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
import { ArrowUpDownIcon } from "lucide-react"

export interface DeliveryRow {
  id: string
  eventType: string
  status: string
  responseStatusCode: number | null
  attempts: number
  createdAt: Date
}

type SortField = "eventType" | "statusCode" | "createdAt" | "attempts"
type SortOrder = "asc" | "desc"

export function WebhookDeliveriesTable({
  deliveries,
}: {
  deliveries: DeliveryRow[]
}) {
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [pageSize, setPageSize] = React.useState<number>(10)
  const [sortField, setSortField] = React.useState<SortField>("createdAt")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc")

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  const sortedDeliveries = React.useMemo(() => {
    const list = [...deliveries]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === "eventType") {
        comparison = a.eventType.localeCompare(b.eventType)
      } else if (sortField === "statusCode") {
        comparison = (a.responseStatusCode || 0) - (b.responseStatusCode || 0)
      } else if (sortField === "attempts") {
        comparison = a.attempts - b.attempts
      } else if (sortField === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return list
  }, [deliveries, sortField, sortOrder])

  const totalItems = sortedDeliveries.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedDeliveries = React.useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedDeliveries.slice(start, start + pageSize)
  }, [sortedDeliveries, safePage, pageSize])

  return (
    <div className="w-full min-w-full rounded-xl border bg-card shadow-2xs overflow-hidden">
      <div className="w-full overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-muted/30 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[200px]"
                onClick={() => handleSort("eventType")}
              >
                <div className="flex items-center gap-1">
                  <span>Event Type</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-center hover:text-foreground min-w-[100px]"
                onClick={() => handleSort("statusCode")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>HTTP Status</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[140px]"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center gap-1">
                  <span>Delivered At</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-right hover:text-foreground min-w-[100px]"
                onClick={() => handleSort("attempts")}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Attempts</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedDeliveries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-20 text-center text-xs text-muted-foreground"
                >
                  No deliveries logged yet.
                </TableCell>
              </TableRow>
            ) : (
              paginatedDeliveries.map((del) => (
                <TableRow key={del.id} className="hover:bg-muted/35 transition-colors border-b border-border/40">
                  <TableCell className="font-mono text-xs font-medium py-3">
                    {del.eventType}
                  </TableCell>

                  <TableCell className="text-center py-3">
                    <Badge
                      variant={
                        del.responseStatusCode && del.responseStatusCode < 300
                          ? "secondary"
                          : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {del.responseStatusCode || del.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground py-3 tabular-nums">
                    {formatDate(del.createdAt)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-xs text-muted-foreground py-3 tabular-nums">
                    {del.attempts} attempt(s)
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
        itemLabel="deliveries"
      />
    </div>
  )
}
