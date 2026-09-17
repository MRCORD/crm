"use client"

import * as React from "react"
import Link from "next/link"
import { updateOpportunityStageAction, OpportunityStage } from "@/actions/crm"
import { formatMicros, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DollarSignIcon,
  Building2Icon,
  CalendarIcon,
  ArrowRightIcon,
  MoreVerticalIcon,
  ActivityIcon,
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

const STAGES: { key: OpportunityStage; label: string; color: string }[] = [
  { key: "DISCOVERY", label: "Discovery", color: "border-t-blue-500" },
  { key: "PROPOSAL", label: "Proposal", color: "border-t-purple-500" },
  { key: "NEGOTIATION", label: "Negotiation", color: "border-t-amber-500" },
  { key: "CLOSED_WON", label: "Closed Won", color: "border-t-emerald-500" },
  { key: "CLOSED_LOST", label: "Closed Lost", color: "border-t-rose-500" },
]

export function KanbanBoard({
  initialOpportunities,
  brands,
}: {
  initialOpportunities: KanbanOpportunity[]
  brands: { id: string; name: string; slug: string; color?: string | null }[]
}) {
  const [opportunities, setOpportunities] =
    React.useState<KanbanOpportunity[]>(initialOpportunities)
  const [selectedBrand, setSelectedBrand] = React.useState<string>("ALL")
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)

  // Keep state updated if server revalidates
  React.useEffect(() => {
    setOpportunities(initialOpportunities)
  }, [initialOpportunities])

  const filteredOpportunities = React.useMemo(() => {
    if (selectedBrand === "ALL") return opportunities
    return opportunities.filter((o) => o.brandId === selectedBrand)
  }, [opportunities, selectedBrand])

  async function handleStageChange(
    oppId: string,
    newStage: OpportunityStage
  ) {
    setUpdatingId(oppId)
    // Optimistic UI update
    setOpportunities((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, stage: newStage } : o))
    )

    try {
      await updateOpportunityStageAction(oppId, newStage, "Moved via Kanban Board")
    } catch (err) {
      // Revert on error
      setOpportunities(initialOpportunities)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Brand / DBA Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-medium text-muted-foreground mr-1">
          DBA:
        </span>
        <Button
          size="sm"
          variant={selectedBrand === "ALL" ? "default" : "outline"}
          onClick={() => setSelectedBrand("ALL")}
          className="h-8 text-xs"
        >
          All Brands ({opportunities.length})
        </Button>
        {brands.map((b) => {
          const count = opportunities.filter((o) => o.brandId === b.id).length
          return (
            <Button
              key={b.id}
              size="sm"
              variant={selectedBrand === b.id ? "default" : "outline"}
              onClick={() => setSelectedBrand(b.id)}
              className="h-8 text-xs flex items-center gap-1.5"
            >
              {b.color && (
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
              )}
              {b.name} ({count})
            </Button>
          )
        })}
      </div>

      {/* Kanban 5 Columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5 items-start">
        {STAGES.map((col) => {
          const columnDeals = filteredOpportunities.filter(
            (o) => o.stage === col.key
          )
          const columnTotal = columnDeals.reduce(
            (sum, o) => sum + BigInt(o.amountMicros || 0),
            BigInt(0)
          )

          return (
            <div
              key={col.key}
              className={`flex flex-col rounded-xl border border-t-4 ${col.color} bg-muted/20 p-3`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {col.label}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {columnDeals.length}
                  </Badge>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {formatMicros(columnTotal.toString())}
                </span>
              </div>

              {/* Deals Cards */}
              <div className="flex flex-col gap-2.5">
                {columnDeals.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No deals in {col.label.toLowerCase()}
                  </div>
                ) : (
                  columnDeals.map((opp) => (
                    <div
                      key={opp.id}
                      className={`group relative flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs transition-all hover:border-primary/50 ${
                        updatingId === opp.id ? "opacity-60 pointer-events-none" : ""
                      }`}
                    >
                      {/* Card Header: Brand pill & stage mover dropdown */}
                      <div className="flex items-center justify-between">
                        {opp.brandName ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-normal"
                            style={{
                              backgroundColor: opp.brandColor
                                ? `${opp.brandColor}20`
                                : undefined,
                              color: opp.brandColor || undefined,
                            }}
                          >
                            {opp.brandName}
                          </Badge>
                        ) : (
                          <span />
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground"
                              />
                            }
                          >
                            <MoreVerticalIcon className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                              Move to stage
                            </div>
                            {STAGES.map((s) => (
                              <DropdownMenuItem
                                key={s.key}
                                disabled={s.key === opp.stage}
                                onClick={() => handleStageChange(opp.id, s.key)}
                                className="text-xs"
                              >
                                {s.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Deal Name (Link to Opportunity detail) */}
                      <Link
                        href={`/opportunities/${opp.id}`}
                        className="text-sm font-semibold hover:underline line-clamp-2"
                      >
                        {opp.name}
                      </Link>

                      {/* Company Name (Link to Company detail) */}
                      <Link
                        href={`/companies/${opp.companyId}`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                      >
                        <Building2Icon className="size-3" />
                        <span className="truncate">{opp.companyName}</span>
                      </Link>

                      {/* Card Footer: Amount & close date */}
                      <div className="mt-1 flex items-center justify-between border-t pt-2">
                        <span className="text-sm font-bold">
                          {formatMicros(opp.amountMicros, opp.currency)}
                        </span>
                        {opp.closeDate && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarIcon className="size-3" />
                            {formatDate(opp.closeDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
