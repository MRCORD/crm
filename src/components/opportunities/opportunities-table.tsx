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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatMicros, formatDate, cn } from "@/lib/utils"
import { stageDotClass } from "@/lib/stage-colors"
import type { KanbanOpportunity, KanbanStage } from "@/components/opportunities/kanban-board"
import {
  Building2Icon,
  CalendarIcon,
  ChevronDownIcon,
  ArrowUpDownIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
  ExternalLinkIcon,
  EyeIcon,
  PlusIcon,
  MoreHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"

type SortField = "name" | "amount" | "stage" | "closeDate" | "probability"
type SortOrder = "asc" | "desc"

function ProbabilityMeter({ percent }: { percent: number | null }) {
  if (typeof percent !== "number") {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const totalBars = 6
  const filledBars = Math.max(1, Math.round((percent / 100) * totalBars))

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5" title={`${percent}% Win Probability`}>
        {Array.from({ length: totalBars }).map((_, i) => {
          const isFilled = i < filledBars
          let barColor = "bg-muted/40"
          if (isFilled) {
            barColor =
              percent >= 70
                ? "bg-emerald-500"
                : percent >= 40
                  ? "bg-amber-500"
                  : "bg-rose-500"
          }
          return (
            <span
              key={i}
              className={cn("w-1 h-3 rounded-[1px] transition-colors", barColor)}
            />
          )
        })}
      </div>
      <span className="tabular-nums font-semibold text-xs text-foreground">
        {percent}%
      </span>
    </div>
  )
}

export function OpportunitiesTable({
  opportunities,
  stages,
  onStageChange,
  onSelectOpportunity,
}: {
  opportunities: KanbanOpportunity[]
  stages: KanbanStage[]
  onStageChange: (oppId: string, newStage: string) => void
  onSelectOpportunity: (opp: KanbanOpportunity) => void
}) {
  const [sortField, setSortField] = React.useState<SortField>("amount")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [pageSize, setPageSize] = React.useState<number>(10)

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  const sortedOpportunities = React.useMemo(() => {
    const list = [...opportunities]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === "amount") {
        const aAmount = BigInt(a.amountMicros || 0)
        const bAmount = BigInt(b.amountMicros || 0)
        comparison = aAmount > bAmount ? 1 : aAmount < bAmount ? -1 : 0
      } else if (sortField === "name") {
        comparison = a.name.localeCompare(b.name)
      } else if (sortField === "stage") {
        comparison = a.stage.localeCompare(b.stage)
      } else if (sortField === "closeDate") {
        const aTime = a.closeDate ? new Date(a.closeDate).getTime() : 0
        const bTime = b.closeDate ? new Date(b.closeDate).getTime() : 0
        comparison = aTime - bTime
      } else if (sortField === "probability") {
        const aProb = a.probabilityPercent ?? 0
        const bProb = b.probabilityPercent ?? 0
        comparison = aProb - bProb
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return list
  }, [opportunities, sortField, sortOrder])

  // Pagination calculations
  const totalItems = sortedOpportunities.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Adjust page if out of bounds
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const paginatedOpportunities = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedOpportunities.slice(start, start + pageSize)
  }, [sortedOpportunities, currentPage, pageSize])

  const isCurrentPageAllSelected =
    paginatedOpportunities.length > 0 &&
    paginatedOpportunities.every((o) => selectedIds.has(o.id))

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isCurrentPageAllSelected) {
        for (const o of paginatedOpportunities) {
          next.delete(o.id)
        }
      } else {
        for (const o of paginatedOpportunities) {
          next.add(o.id)
        }
      }
      return next
    })
  }

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Summary calculations
  const totalPipelineMicros = React.useMemo(() => {
    return sortedOpportunities.reduce(
      (sum, o) => sum + BigInt(o.amountMicros || 0),
      BigInt(0)
    )
  }, [sortedOpportunities])

  const avgWinProbability = React.useMemo(() => {
    const withProb = sortedOpportunities.filter(
      (o) => typeof o.probabilityPercent === "number"
    )
    if (withProb.length === 0) return 0
    const sum = withProb.reduce((s, o) => s + (o.probabilityPercent ?? 0), 0)
    return Math.round(sum / withProb.length)
  }, [sortedOpportunities])

  const startRange = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRange = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="w-full min-w-full rounded-xl border bg-card shadow-2xs overflow-hidden">
      {/* Table Container */}
      <div className="w-full overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-muted/30 border-b">
            <TableRow className="hover:bg-transparent">
              {/* Checkbox column */}
              <TableHead className="w-10 px-3 text-center">
                <input
                  type="checkbox"
                  checked={isCurrentPageAllSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all on this page"
                  className="rounded-xs border-border/80 text-primary focus:ring-primary size-3.5 cursor-pointer align-middle"
                />
              </TableHead>

              {/* Deal Name */}
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[220px]"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  <span>Deal</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              {/* Stage */}
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[140px]"
                onClick={() => handleSort("stage")}
              >
                <div className="flex items-center gap-1">
                  <span>Stage</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              {/* Company */}
              <TableHead className="py-3 text-xs font-semibold min-w-[180px]">
                Company
              </TableHead>

              {/* Pipeline Value */}
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold text-right hover:text-foreground min-w-[130px]"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Pipeline Value</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              {/* Win Probability with Meter */}
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[140px]"
                onClick={() => handleSort("probability")}
              >
                <div className="flex items-center gap-1">
                  <span>Win Probability</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              {/* Health */}
              <TableHead className="py-3 text-xs font-semibold min-w-[110px]">
                Health
              </TableHead>

              {/* Close Date */}
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[130px]"
                onClick={() => handleSort("closeDate")}
              >
                <div className="flex items-center gap-1">
                  <span>Close Date</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              {/* Action Menu */}
              <TableHead className="text-right py-3 text-xs font-semibold w-16 pr-4">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedOpportunities.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-28 text-center text-xs text-muted-foreground"
                >
                  No opportunities found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedOpportunities.map((opp) => {
                const currentStage = stages.find((s) => s.key === opp.stage)
                const healthScore = opp.healthScore?.toUpperCase()
                const isSelected = selectedIds.has(opp.id)

                return (
                  <TableRow
                    key={opp.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border/40 hover:bg-muted/35",
                      isSelected && "bg-primary/5 hover:bg-primary/8"
                    )}
                    onClick={() => onSelectOpportunity(opp)}
                  >
                    {/* Checkbox */}
                    <TableCell
                      className="w-10 px-3 text-center"
                      onClick={(e) => toggleSelectRow(opp.id, e)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        aria-label={`Select ${opp.name}`}
                        className="rounded-xs border-border/80 text-primary focus:ring-primary size-3.5 cursor-pointer align-middle"
                      />
                    </TableCell>

                    {/* Deal Name & Brand pill */}
                    <TableCell className="font-medium text-xs py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground hover:underline">
                          {opp.name}
                        </span>
                        {opp.brandName && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium shrink-0"
                            style={{
                              backgroundColor: opp.brandColor
                                ? `${opp.brandColor}18`
                                : undefined,
                              color: opp.brandColor || undefined,
                            }}
                          >
                            {opp.brandName}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Stage Pill with inline mover */}
                    <TableCell
                      className="text-xs py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 border bg-background/80 hover:bg-muted/60 text-[11px] font-medium transition-colors"
                            >
                              <span
                                className={cn(
                                  "size-2 rounded-full shrink-0",
                                  stageDotClass(currentStage?.color)
                                )}
                              />
                              <span>{currentStage?.label ?? opp.stage}</span>
                              <ChevronDownIcon className="size-3 opacity-50 ml-0.5" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="start" className="w-40">
                          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                            Change Stage
                          </div>
                          {stages.map((s) => (
                            <DropdownMenuItem
                              key={s.key}
                              disabled={s.key === opp.stage}
                              onClick={() => onStageChange(opp.id, s.key)}
                              className="text-xs flex items-center justify-between"
                            >
                              <span>{s.label}</span>
                              {s.key === opp.stage && (
                                <span className="size-1.5 rounded-full bg-primary" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                    {/* Company */}
                    <TableCell className="text-xs py-3 text-muted-foreground">
                      <Link
                        href={`/companies/${opp.companyId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 hover:text-foreground hover:underline w-fit"
                      >
                        <Building2Icon className="size-3 shrink-0 opacity-60" />
                        <span className="truncate">{opp.companyName}</span>
                      </Link>
                    </TableCell>

                    {/* Pipeline Value */}
                    <TableCell className="text-right text-xs py-3 font-bold tabular-nums text-foreground">
                      {formatMicros(opp.amountMicros, opp.currency)}
                    </TableCell>

                    {/* Win Probability with Segmented Progress Bar */}
                    <TableCell className="text-xs py-3">
                      <ProbabilityMeter percent={opp.probabilityPercent} />
                    </TableCell>

                    {/* Health Score */}
                    <TableCell className="text-xs py-3">
                      {healthScore === "HEALTHY" ? (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2Icon className="size-3" />
                          Healthy
                        </span>
                      ) : healthScore === "AT_RISK" ? (
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangleIcon className="size-3" />
                          At Risk
                        </span>
                      ) : healthScore === "CRITICAL" ? (
                        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <XCircleIcon className="size-3" />
                          Critical
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Close Date */}
                    <TableCell className="text-xs py-3 text-muted-foreground tabular-nums">
                      {opp.closeDate ? (
                        <span className="flex items-center gap-1 text-[11px]">
                          <CalendarIcon className="size-3 opacity-60" />
                          {formatDate(opp.closeDate)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    {/* Actions Menu */}
                    <TableCell
                      className="text-right py-3 pr-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-muted-foreground hover:text-foreground"
                              aria-label="Actions"
                            />
                          }
                        >
                          <MoreHorizontalIcon className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => onSelectOpportunity(opp)}
                            className="text-xs flex items-center gap-2"
                          >
                            <EyeIcon className="size-3.5" />
                            <span>Quick Inspect</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            render={
                              <Link
                                href={`/opportunities/${opp.id}`}
                                className="text-xs flex items-center gap-2"
                              />
                            }
                          >
                            <ExternalLinkIcon className="size-3.5" />
                            <span>Full Record</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 bg-background text-xs text-muted-foreground">
        {/* Left: Page Size Selector & Showing Range */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            aria-label="Rows per page"
            className="h-7 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-hidden cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <span className="text-[11px] text-muted-foreground ml-2 tabular-nums">
            Showing <strong className="text-foreground font-medium">{startRange}–{endRange}</strong> of{" "}
            <strong className="text-foreground font-medium">{totalItems}</strong> deals
          </span>
        </div>

        {/* Right: Navigation Buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(1)}
            className="h-7 px-2 text-xs font-medium"
            title="First Page"
          >
            <ChevronsLeftIcon className="size-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="h-7 px-2.5 text-xs font-medium gap-1"
          >
            <ChevronLeftIcon className="size-3.5" />
            <span>Prev</span>
          </Button>

          <div className="flex items-center px-2 text-xs font-medium text-foreground tabular-nums">
            <span>
              {currentPage} / {totalPages}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="h-7 px-2.5 text-xs font-medium gap-1"
          >
            <span>Next</span>
            <ChevronRightIcon className="size-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
            className="h-7 px-2 text-xs font-medium"
            title="Last Page"
          >
            <ChevronsRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Bottom Calculation Footer Bar (sales-crm reference) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">
            {totalItems} Deals in view
          </span>
          {selectedIds.size > 0 && (
            <span className="text-primary font-medium">
              ({selectedIds.size} selected)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span>Sum of pipeline:</span>
            <strong className="text-foreground font-semibold tabular-nums">
              {formatMicros(totalPipelineMicros.toString())}
            </strong>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <span>Avg win prob:</span>
            <strong className="text-foreground font-semibold tabular-nums">
              {avgWinProbability}%
            </strong>
          </div>
          <span>•</span>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors cursor-pointer"
          >
            <PlusIcon className="size-3" />
            <span>{isCurrentPageAllSelected ? "Deselect Page" : "Select Page"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
