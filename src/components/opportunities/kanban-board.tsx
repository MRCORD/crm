"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { updateOpportunityStageAction, OpportunityStage } from "@/actions/crm"
import { formatMicros, formatDate, cn } from "@/lib/utils"
import { stageDotClass } from "@/lib/stage-colors"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Kanban,
  KanbanBoard as KanbanBoardPrimitive,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  type KanbanCommitMeta,
} from "@/components/ui/kanban"
import { AddStageDialog, StageCategoryOption } from "@/components/opportunities/add-stage-dialog"
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table"
import { DealInspectorSheet } from "@/components/opportunities/deal-inspector-sheet"
import {
  Building2Icon,
  CalendarIcon,
  MoreHorizontalIcon,
  CheckIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  XIcon,
  TrendingUpIcon,
  EyeIcon,
} from "lucide-react"

export interface KanbanOpportunity {
  id: string
  name: string
  stage: string
  amountMicros: string
  currency: string
  probabilityPercent: number | null
  closeDate: Date | null
  healthScore: string | null
  createdAt: Date
  companyId: string
  companyName: string
  companyDomain: string | null
  brandId: string | null
  brandName: string | null
  brandColor: string | null
}

export interface KanbanStage {
  key: string
  label: string
  color: string
}

function buildColumnsMap(
  opps: KanbanOpportunity[],
  stages: KanbanStage[]
): Record<string, KanbanOpportunity[]> {
  const result: Record<string, KanbanOpportunity[]> = {}
  for (const s of stages) {
    result[s.key] = []
  }

  for (const opp of opps) {
    if (result[opp.stage]) {
      result[opp.stage].push(opp)
    } else {
      const fallback = stages[0]?.key
      if (fallback) {
        if (!result[fallback]) result[fallback] = []
        result[fallback].push(opp)
      }
    }
  }

  return result
}

interface OpportunityCardProps {
  opp: KanbanOpportunity
  stages: KanbanStage[]
  asHandle?: boolean
  isOverlay?: boolean
  onManualStageChange: (oppId: string, newStage: string) => void
  onSelect: (opp: KanbanOpportunity) => void
}

function OpportunityCard({
  opp,
  stages,
  asHandle = true,
  isOverlay = false,
  onManualStageChange,
  onSelect,
}: OpportunityCardProps) {
  const health = opp.healthScore?.toUpperCase()

  const cardBody = (
    <div
      onClick={() => {
        if (!isOverlay) onSelect(opp)
      }}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs select-none cursor-grab active:cursor-grabbing",
        isOverlay && "shadow-xl ring-2 ring-primary/40 rotate-1 cursor-grabbing bg-card border-primary/50"
      )}
    >
      {/* Top: Deal title & Quick Actions */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {health === "HEALTHY" ? (
            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" title="Health: Healthy" />
          ) : health === "AT_RISK" ? (
            <span className="size-1.5 rounded-full bg-amber-500 shrink-0" title="Health: At Risk" />
          ) : health === "CRITICAL" ? (
            <span className="size-1.5 rounded-full bg-rose-500 shrink-0" title="Health: Critical" />
          ) : null}

          <span className="text-xs font-semibold leading-snug hover:underline line-clamp-2 text-foreground">
            {opp.name}
          </span>
        </div>

        {!isOverlay && (
          <div className="flex items-center -mr-1 -mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="size-5 text-muted-foreground hover:text-foreground"
              aria-label="Inspect deal"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(opp)
              }}
            >
              <EyeIcon className="size-3" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 text-muted-foreground hover:text-foreground"
                    aria-label="Deal options"
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              >
                <MoreHorizontalIcon className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                  Move to stage
                </div>
                {stages.map((s) => (
                  <DropdownMenuItem
                    key={s.key}
                    disabled={s.key === opp.stage}
                    onClick={(e) => {
                      e.stopPropagation()
                      onManualStageChange(opp.id, s.key)
                    }}
                    className="text-xs flex items-center justify-between"
                  >
                    <span>{s.label}</span>
                    {s.key === opp.stage && (
                      <CheckIcon className="size-3 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Company Name */}
      <Link
        href={`/companies/${opp.companyId}`}
        onClick={(e) => {
          e.stopPropagation()
          if (isOverlay) e.preventDefault()
        }}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline w-fit max-w-full"
      >
        <Building2Icon className="size-3 shrink-0 opacity-60" />
        <span className="truncate">{opp.companyName}</span>
      </Link>

      {/* Footer: Amount, Win Probability, Close Date & Brand */}
      <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-foreground text-xs tabular-nums">
            {formatMicros(opp.amountMicros, opp.currency)}
          </span>
          {typeof opp.probabilityPercent === "number" && (
            <span
              className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded-sm tabular-nums flex items-center gap-0.5"
              title="Win Probability"
            >
              <TrendingUpIcon className="size-2.5" />
              {opp.probabilityPercent}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {opp.brandName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium leading-none"
              style={{
                backgroundColor: opp.brandColor ? `${opp.brandColor}18` : undefined,
                color: opp.brandColor || undefined,
              }}
            >
              {opp.brandName}
            </span>
          )}
          {opp.closeDate && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
              <CalendarIcon className="size-2.5 opacity-60" />
              {formatDate(opp.closeDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (isOverlay) {
    return cardBody
  }

  return (
    <KanbanItem value={opp.id} className="w-full">
      {asHandle ? (
        <KanbanItemHandle>{cardBody}</KanbanItemHandle>
      ) : (
        cardBody
      )}
    </KanbanItem>
  )
}

type ViewMode = "board" | "table"
type FilterPreset = "all" | "high-value" | "closing-soon" | "at-risk"

export function KanbanBoard({
  initialOpportunities,
  stages,
  categories,
}: {
  initialOpportunities: KanbanOpportunity[]
  stages: KanbanStage[]
  categories: StageCategoryOption[]
}) {
  const [opportunities, setOpportunities] =
    React.useState<KanbanOpportunity[]>(initialOpportunities)
  const [viewMode, setViewMode] = React.useState<ViewMode>("board")
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [filterPreset, setFilterPreset] = React.useState<FilterPreset>("all")
  const [selectedOpportunity, setSelectedOpportunity] =
    React.useState<KanbanOpportunity | null>(null)

  // Keep state updated if server revalidates props
  React.useEffect(() => {
    setOpportunities(initialOpportunities)
  }, [initialOpportunities])

  // Filtered dataset based on search & quick filters
  const filteredOpportunities = React.useMemo(() => {
    return opportunities.filter((opp) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = opp.name.toLowerCase().includes(q)
        const matchCompany = opp.companyName.toLowerCase().includes(q)
        const matchBrand = opp.brandName?.toLowerCase().includes(q)
        if (!matchName && !matchCompany && !matchBrand) return false
      }

      // 2. Filter Presets
      if (filterPreset === "high-value") {
        const amount = BigInt(opp.amountMicros || 0)
        // > $50,000 (50,000 * 1,000,000 micros)
        if (amount < BigInt(50_000_000_000)) return false
      } else if (filterPreset === "closing-soon") {
        if (!opp.closeDate) return false
        const close = new Date(opp.closeDate).getTime()
        const now = Date.now()
        const thirtyDays = 30 * 24 * 60 * 60 * 1000
        if (close < now || close > now + thirtyDays) return false
      } else if (filterPreset === "at-risk") {
        const health = opp.healthScore?.toUpperCase()
        if (health !== "AT_RISK" && health !== "CRITICAL") return false
      }

      return true
    })
  }, [opportunities, searchQuery, filterPreset])

  // Columns derived from filtered dataset
  const [columns, setColumns] = React.useState<
    Record<string, KanbanOpportunity[]>
  >(() => buildColumnsMap(filteredOpportunities, stages))

  React.useEffect(() => {
    setColumns(buildColumnsMap(filteredOpportunities, stages))
  }, [filteredOpportunities, stages])

  // Handle Drag & Drop commit (persists to backend with optimistic UI & rollback)
  const handleValueCommit = (
    _nextColumns: Record<string, KanbanOpportunity[]>,
    meta: KanbanCommitMeta<KanbanOpportunity>
  ) => {
    if (meta.kind !== "item") return

    const { activeContainer, overContainer, event, previousValue } = meta
    const oppId = String(event.active.id)

    // Reordered inside same column - no backend stage change needed
    if (activeContainer === overContainer) {
      return
    }

    const targetStage = stages.find((s) => s.key === overContainer)
    const targetLabel = targetStage?.label ?? overContainer

    // Lookup opportunity name for toast
    let oppName = "Deal"
    for (const list of Object.values(previousValue)) {
      const match = list.find((o) => o.id === oppId)
      if (match) {
        oppName = match.name
        break
      }
    }

    // Optimistically update opportunity list
    setOpportunities((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, stage: overContainer } : o))
    )

    const isWon =
      targetStage?.label.toLowerCase().includes("won") ||
      overContainer.toLowerCase().includes("won")

    toast.promise(
      updateOpportunityStageAction(
        oppId,
        overContainer,
        "Moved via Kanban drag and drop"
      ),
      {
        loading: `Moving "${oppName}" to ${targetLabel}...`,
        success: isWon
          ? `🎉 Deal Closed Won! "${oppName}" moved to ${targetLabel}`
          : `"${oppName}" moved to ${targetLabel}`,
        error: (err) => {
          setColumns(previousValue)
          setOpportunities((prev) =>
            prev.map((o) =>
              o.id === oppId ? { ...o, stage: activeContainer } : o
            )
          )
          return `Failed to move deal: ${err instanceof Error ? err.message : "Server error"}`
        },
      }
    )
  }

  // Handle manual move from Dropdown Menu or Inspector
  const handleManualStageChange = (oppId: string, newStage: string) => {
    const previousColumns = columns
    const previousOpportunities = opportunities
    const currentOpp = opportunities.find((o) => o.id === oppId)
    const oppName = currentOpp?.name ?? "Deal"
    const fromStage = currentOpp?.stage ?? ""

    if (fromStage === newStage) return

    const targetStage = stages.find((s) => s.key === newStage)
    const targetLabel = targetStage?.label ?? newStage

    // Optimistic local state update
    setOpportunities((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, stage: newStage } : o))
    )

    // Also update currently inspected opportunity if open
    setSelectedOpportunity((prev) =>
      prev && prev.id === oppId ? { ...prev, stage: newStage } : prev
    )

    setColumns((prev) => {
      const next: Record<string, KanbanOpportunity[]> = {}
      let movedItem: KanbanOpportunity | null = null

      for (const [key, items] of Object.entries(prev)) {
        const filtered = items.filter((item) => {
          if (item.id === oppId) {
            movedItem = { ...item, stage: newStage }
            return false
          }
          return true
        })
        next[key] = filtered
      }

      if (movedItem && next[newStage]) {
        next[newStage] = [movedItem, ...next[newStage]]
      }

      return next
    })

    const isWon =
      targetStage?.label.toLowerCase().includes("won") ||
      newStage.toLowerCase().includes("won")

    toast.promise(
      updateOpportunityStageAction(
        oppId,
        newStage as OpportunityStage,
        "Moved via Pipeline action"
      ),
      {
        loading: `Moving "${oppName}" to ${targetLabel}...`,
        success: isWon
          ? `🎉 Deal Closed Won! "${oppName}" moved to ${targetLabel}`
          : `"${oppName}" moved to ${targetLabel}`,
        error: (err) => {
          setColumns(previousColumns)
          setOpportunities(previousOpportunities)
          setSelectedOpportunity((prev) =>
            prev && prev.id === oppId ? { ...prev, stage: fromStage } : prev
          )
          return `Failed to move deal: ${err instanceof Error ? err.message : "Server error"}`
        },
      }
    )
  }

  const filteredTotalMicros = React.useMemo(() => {
    return filteredOpportunities.reduce(
      (sum, o) => sum + BigInt(o.amountMicros || 0),
      BigInt(0)
    )
  }, [filteredOpportunities])

  return (
    <div className="flex flex-col gap-3 w-full max-w-full min-w-0">
      {/* Search, Filters & View Mode Switcher Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-0.5">
        {/* Left: View Mode Toggle & Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border bg-muted/35 p-0.5 shrink-0">
            <Button
              size="sm"
              variant={viewMode === "board" ? "secondary" : "ghost"}
              onClick={() => setViewMode("board")}
              className={cn(
                "h-7 px-2.5 text-xs font-medium gap-1.5",
                viewMode === "board" && "bg-background text-foreground shadow-2xs font-semibold"
              )}
            >
              <LayoutGridIcon className="size-3.5" />
              <span>Board</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              onClick={() => setViewMode("table")}
              className={cn(
                "h-7 px-2.5 text-xs font-medium gap-1.5",
                viewMode === "table" && "bg-background text-foreground shadow-2xs font-semibold"
              )}
            >
              <ListIcon className="size-3.5" />
              <span>Table</span>
            </Button>
          </div>

          {/* Live Search Input */}
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deals, companies..."
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-7 text-xs shadow-2xs outline-hidden placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-0.5"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>

          <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
            {filteredOpportunities.length} {filteredOpportunities.length === 1 ? "deal" : "deals"} (
            {formatMicros(filteredTotalMicros.toString())})
          </span>
        </div>

        {/* Right: Quick Filter Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Button
            size="sm"
            variant={filterPreset === "all" ? "default" : "outline"}
            onClick={() => setFilterPreset("all")}
            className="h-7 text-xs px-2.5 font-medium"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filterPreset === "high-value" ? "default" : "outline"}
            onClick={() =>
              setFilterPreset(filterPreset === "high-value" ? "all" : "high-value")
            }
            className="h-7 text-xs px-2.5 font-medium"
          >
            &gt; $50k
          </Button>
          <Button
            size="sm"
            variant={filterPreset === "closing-soon" ? "default" : "outline"}
            onClick={() =>
              setFilterPreset(filterPreset === "closing-soon" ? "all" : "closing-soon")
            }
            className="h-7 text-xs px-2.5 font-medium"
          >
            Closing Soon
          </Button>
          <Button
            size="sm"
            variant={filterPreset === "at-risk" ? "default" : "outline"}
            onClick={() =>
              setFilterPreset(filterPreset === "at-risk" ? "all" : "at-risk")
            }
            className="h-7 text-xs px-2.5 font-medium"
          >
            At Risk
          </Button>
        </div>
      </div>

      {/* Main Workspace: Board vs Table View */}
      {viewMode === "table" ? (
        <OpportunitiesTable
          opportunities={filteredOpportunities}
          stages={stages}
          onStageChange={handleManualStageChange}
          onSelectOpportunity={(opp) => setSelectedOpportunity(opp)}
        />
      ) : (
        <Kanban
          value={columns}
          onValueChange={setColumns}
          getItemValue={(item) => item.id}
          onValueCommit={handleValueCommit}
          className="w-full max-w-full min-w-0"
        >
          <KanbanBoardPrimitive className="flex gap-3 overflow-x-auto pb-4 pt-1 items-start min-h-[calc(100vh-17rem)] w-full max-w-full min-w-0">
            {stages.map((col) => {
              const columnDeals = columns[col.key] ?? []
              const columnTotal = columnDeals.reduce(
                (sum, o) => sum + BigInt(o.amountMicros || 0),
                BigInt(0)
              )

              return (
                <KanbanColumn
                  key={col.key}
                  value={col.key}
                  className="flex w-72 sm:w-76 shrink-0 flex-col rounded-xl bg-muted/35 border border-border/40 p-1.5 transition-colors"
                >
                  {/* Column Header: Clean & Lightweight */}
                  <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn("size-2 rounded-full shrink-0", stageDotClass(col.color))}
                      />
                      <span className="text-xs font-semibold text-foreground">
                        {col.label}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                        ({columnDeals.length})
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      {formatMicros(columnTotal.toString())}
                    </span>
                  </div>

                  {/* Column Card List - Independent vertical scroll */}
                  <KanbanColumnContent
                    value={col.key}
                    className="flex flex-col gap-2 p-1 overflow-y-auto max-h-[calc(100vh-21rem)] min-h-[140px]"
                  >
                    {columnDeals.length === 0 ? (
                      <div className="flex h-20 flex-col items-center justify-center rounded-lg border border-dashed border-border/50 text-center p-2 text-[11px] text-muted-foreground/60">
                        <span>Empty</span>
                      </div>
                    ) : (
                      columnDeals.map((opp) => (
                        <OpportunityCard
                          key={opp.id}
                          opp={opp}
                          stages={stages}
                          onManualStageChange={handleManualStageChange}
                          onSelect={(item) => setSelectedOpportunity(item)}
                        />
                      ))
                    )}
                  </KanbanColumnContent>
                </KanbanColumn>
              )
            })}

            {/* Add Stage Column Trigger */}
            <div className="w-64 sm:w-72 shrink-0 pt-0.5">
              <AddStageDialog categories={categories} />
            </div>
          </KanbanBoardPrimitive>

          {/* Drag Overlay: Follows cursor during drag */}
          <KanbanOverlay>
            {({ value, variant }) => {
              if (variant === "item") {
                const opp = opportunities.find((o) => o.id === String(value))
                if (!opp) return null
                return (
                  <div className="w-72 sm:w-76 pointer-events-none">
                    <OpportunityCard
                      opp={opp}
                      stages={stages}
                      isOverlay
                      onManualStageChange={() => {}}
                      onSelect={() => {}}
                    />
                  </div>
                )
              }
              return null
            }}
          </KanbanOverlay>
        </Kanban>
      )}

      {/* Slide-over Deal Inspector Sheet */}
      <DealInspectorSheet
        opportunity={selectedOpportunity}
        stages={stages}
        open={Boolean(selectedOpportunity)}
        onOpenChange={(open) => {
          if (!open) setSelectedOpportunity(null)
        }}
        onStageChange={handleManualStageChange}
      />
    </div>
  )
}
