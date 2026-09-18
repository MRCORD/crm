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
import { RouteIcon, ArrowUpDownIcon } from "lucide-react"

export interface RoutingRuleRow {
  id: string
  name: string
  targetEntity: string
  assignmentStrategy: string
  priority: number
  isActive: boolean
  candidateUserIds: string[]
  createdAt: Date
}

type SortField = "priority" | "name" | "targetEntity" | "strategy" | "status" | "createdAt"
type SortOrder = "asc" | "desc"

export function RoutingTable({
  rules,
}: {
  rules: RoutingRuleRow[]
}) {
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [pageSize, setPageSize] = React.useState<number>(10)
  const [sortField, setSortField] = React.useState<SortField>("priority")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc")

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder(field === "priority" ? "asc" : "desc")
    }
  }

  const sortedRules = React.useMemo(() => {
    const list = [...rules]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === "priority") {
        comparison = a.priority - b.priority
      } else if (sortField === "name") {
        comparison = a.name.localeCompare(b.name)
      } else if (sortField === "targetEntity") {
        comparison = a.targetEntity.localeCompare(b.targetEntity)
      } else if (sortField === "strategy") {
        comparison = a.assignmentStrategy.localeCompare(b.assignmentStrategy)
      } else if (sortField === "status") {
        comparison = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)
      } else if (sortField === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return list
  }, [rules, sortField, sortOrder])

  const totalItems = sortedRules.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const paginatedRules = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRules.slice(start, start + pageSize)
  }, [sortedRules, currentPage, pageSize])

  return (
    <div className="w-full min-w-full rounded-xl border bg-card shadow-2xs overflow-hidden">
      <div className="w-full overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-muted/30 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground w-20"
                onClick={() => handleSort("priority")}
              >
                <div className="flex items-center gap-1">
                  <span>Priority</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[180px]"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  <span>Rule Name</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead className="py-3 text-xs font-semibold min-w-[120px]">
                Target Entity
              </TableHead>

              <TableHead className="py-3 text-xs font-semibold min-w-[140px]">
                Strategy
              </TableHead>

              <TableHead className="py-3 text-xs font-semibold text-center min-w-[90px]">
                Assignees
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
            {paginatedRules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RouteIcon className="size-8 text-muted-foreground/40" />
                    <span className="text-xs">No assignment rules configured.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRules.map((rule) => (
                <TableRow key={rule.id} className="hover:bg-muted/35 transition-colors border-b border-border/40">
                  <TableCell className="font-mono text-xs font-semibold py-3">
                    #{rule.priority}
                  </TableCell>

                  <TableCell className="font-medium text-xs text-foreground py-3">
                    {rule.name}
                  </TableCell>

                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-[10px]">
                      {rule.targetEntity}
                    </Badge>
                  </TableCell>

                  <TableCell className="py-3">
                    <Badge variant="secondary" className="text-[10px]">
                      {rule.assignmentStrategy.replace("_", " ")}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center text-xs text-muted-foreground py-3">
                    {rule.candidateUserIds.length} users
                  </TableCell>

                  <TableCell className="text-center py-3">
                    <Badge variant={rule.isActive ? "default" : "outline"} className="text-[10px]">
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground py-3 tabular-nums">
                    {formatDate(rule.createdAt)}
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
        itemLabel="rules"
      />
    </div>
  )
}
