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

export interface EnrollmentRow {
  id: string
  personId: string
  personName: string
  personEmail: string
  sequenceId: string
  sequenceName: string
  currentStep: number
  status: string
  enrolledAt: Date
}

type SortField = "person" | "sequence" | "step" | "status" | "enrolledAt"
type SortOrder = "asc" | "desc"

export function EnrollmentsTable({
  enrollments,
}: {
  enrollments: EnrollmentRow[]
}) {
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [pageSize, setPageSize] = React.useState<number>(10)
  const [sortField, setSortField] = React.useState<SortField>("enrolledAt")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc")

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  const sortedEnrollments = React.useMemo(() => {
    const list = [...enrollments]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === "person") {
        comparison = a.personName.localeCompare(b.personName)
      } else if (sortField === "sequence") {
        comparison = a.sequenceName.localeCompare(b.sequenceName)
      } else if (sortField === "step") {
        comparison = a.currentStep - b.currentStep
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status)
      } else if (sortField === "enrolledAt") {
        comparison = new Date(a.enrolledAt).getTime() - new Date(b.enrolledAt).getTime()
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return list
  }, [enrollments, sortField, sortOrder])

  const totalItems = sortedEnrollments.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const paginatedEnrollments = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedEnrollments.slice(start, start + pageSize)
  }, [sortedEnrollments, currentPage, pageSize])

  return (
    <div className="w-full min-w-full rounded-xl border bg-card shadow-2xs overflow-hidden">
      <div className="w-full overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-muted/30 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[180px]"
                onClick={() => handleSort("person")}
              >
                <div className="flex items-center gap-1">
                  <span>Contact</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[160px]"
                onClick={() => handleSort("sequence")}
              >
                <div className="flex items-center gap-1">
                  <span>Sequence</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-center hover:text-foreground min-w-[110px]"
                onClick={() => handleSort("step")}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Current Step</span>
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
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[120px]"
                onClick={() => handleSort("enrolledAt")}
              >
                <div className="flex items-center gap-1">
                  <span>Enrolled At</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedEnrollments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-xs text-muted-foreground"
                >
                  No contacts enrolled in sequences yet.
                </TableCell>
              </TableRow>
            ) : (
              paginatedEnrollments.map((enr) => (
                <TableRow key={enr.id} className="hover:bg-muted/35 transition-colors border-b border-border/40">
                  <TableCell className="font-medium py-3">
                    <div className="font-semibold text-foreground text-xs">{enr.personName}</div>
                    <div className="text-[11px] text-muted-foreground">{enr.personEmail}</div>
                  </TableCell>

                  <TableCell className="text-xs text-foreground py-3">
                    {enr.sequenceName}
                  </TableCell>

                  <TableCell className="text-center py-3">
                    <Badge variant="outline" className="text-[10px]">
                      Step {enr.currentStep}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center py-3">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {enr.status.toLowerCase()}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground py-3 tabular-nums">
                    {formatDate(enr.enrolledAt)}
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
        itemLabel="enrollments"
      />
    </div>
  )
}
