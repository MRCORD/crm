"use client"

import * as React from "react"
import Link from "next/link"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatMicros, formatDate, cn } from "@/lib/utils"
import { stageDotClass } from "@/lib/stage-colors"
import type { KanbanOpportunity, KanbanStage } from "@/components/opportunities/kanban-board"
import {
  Building2Icon,
  CalendarIcon,
  ExternalLinkIcon,
  ActivityIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
  ArrowRightIcon,
  TagIcon,
  ClockIcon,
  BriefcaseIcon,
  CheckIcon,
} from "lucide-react"

function SegmentedMeter({ percent }: { percent: number | null }) {
  if (typeof percent !== "number") {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const totalBars = 6
  const filledBars = Math.max(1, Math.round((percent / 100) * totalBars))

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: totalBars }).map((_, i) => {
          const isFilled = i < filledBars
          let barColor = "bg-muted/60"
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
              className={cn("w-1.5 h-3.5 rounded-[1px] transition-colors", barColor)}
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

export function DealInspectorSheet({
  opportunity,
  stages,
  open,
  onOpenChange,
  onStageChange,
}: {
  opportunity: KanbanOpportunity | null
  stages: KanbanStage[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onStageChange: (oppId: string, newStage: string) => void
}) {
  if (!opportunity) return null

  const currentStageIndex = stages.findIndex((s) => s.key === opportunity.stage)
  const currentStage = stages[currentStageIndex]
  const nextStage = stages[currentStageIndex + 1]

  const healthScore = opportunity.healthScore?.toUpperCase()
  const rawAmount = BigInt(opportunity.amountMicros || 0)
  const prob = opportunity.probabilityPercent ?? 0
  const weightedAmount = (rawAmount * BigInt(prob)) / BigInt(100)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        hasOverlay={false}
        style={{
          backgroundColor: "var(--background, #ffffff)",
          opacity: 1,
        }}
        className="w-full sm:w-[540px] md:w-[600px] lg:w-[640px] max-w-full p-0 flex flex-col bg-background text-foreground border-l border-border shadow-2xl z-50"
      >
        {/* Pinned Header Bar */}
        <SheetHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
          <SheetDescription className="sr-only">
            Deal inspector preview for {opportunity.name}
          </SheetDescription>

          {/* Top metadata tags & Full Record Link */}
          <div className="flex items-center justify-between gap-2 pr-8">
            <div className="flex items-center gap-2">
              {opportunity.brandName ? (
                <Badge
                  variant="secondary"
                  className="text-xs font-medium px-2 py-0.5"
                  style={{
                    backgroundColor: opportunity.brandColor
                      ? `${opportunity.brandColor}18`
                      : undefined,
                    color: opportunity.brandColor || undefined,
                  }}
                >
                  {opportunity.brandName}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs uppercase font-medium">
                  Direct Account
                </Badge>
              )}

              <span className="text-[11px] text-muted-foreground font-mono">
                ID: {opportunity.id.slice(0, 8)}
              </span>
            </div>

            <Link
              href={`/opportunities/${opportunity.id}`}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-medium transition-colors"
            >
              <span>Full Record</span>
              <ExternalLinkIcon className="size-3.5" />
            </Link>
          </div>

          {/* Opportunity Title */}
          <SheetTitle className="text-xl font-bold tracking-tight text-foreground mt-3 leading-snug">
            {opportunity.name}
          </SheetTitle>

          {/* Company Name */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
            <Building2Icon className="size-3.5 shrink-0 text-muted-foreground/70" />
            <Link
              href={`/companies/${opportunity.companyId}`}
              className="hover:underline hover:text-foreground font-semibold text-foreground/90"
            >
              {opportunity.companyName}
            </Link>
            {opportunity.companyDomain && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-muted-foreground/80">{opportunity.companyDomain}</span>
              </>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable Details Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
          {/* Financial Hero Stats Card */}
          <div className="rounded-xl border bg-muted/30 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Total Deal Value
              </span>
              <p className="text-xl font-bold tracking-tight text-foreground tabular-nums mt-1">
                {formatMicros(opportunity.amountMicros, opportunity.currency)}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Weighted Forecast
              </span>
              <p className="text-xl font-bold tracking-tight text-foreground/90 tabular-nums mt-1">
                {formatMicros(weightedAmount.toString(), opportunity.currency)}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
                Win Probability
              </span>
              <div className="mt-2">
                <SegmentedMeter percent={opportunity.probabilityPercent} />
              </div>
            </div>
          </div>

          {/* Pipeline Stage Horizontal Stepper Track */}
          <div className="space-y-3 rounded-xl border bg-muted/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Stage Progression
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Current: <strong className="text-foreground font-semibold">{currentStage?.label ?? opportunity.stage}</strong> (Step {currentStageIndex + 1} of {stages.length})
                </span>
              </div>

              {nextStage && (
                <Button
                  size="sm"
                  onClick={() => onStageChange(opportunity.id, nextStage.key)}
                  className="h-7 text-xs px-3 gap-1.5 font-medium cursor-pointer shadow-xs"
                >
                  <span>Advance to {nextStage.label}</span>
                  <ArrowRightIcon className="size-3" />
                </Button>
              )}
            </div>

            {/* Linear Stage Progress Bar */}
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden flex">
              {stages.map((s, idx) => (
                <div
                  key={s.key}
                  className={cn(
                    "flex-1 h-full border-r last:border-r-0 border-background transition-colors",
                    idx <= currentStageIndex ? "bg-primary" : "bg-transparent"
                  )}
                />
              ))}
            </div>

            {/* Stage Selection Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              {stages.map((s, idx) => {
                const isCurrent = s.key === opportunity.stage
                const isPast = idx < currentStageIndex

                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onStageChange(opportunity.id, s.key)}
                    className={cn(
                      "py-2 px-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1",
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                        : isPast
                          ? "bg-muted/50 border-border/80 text-foreground font-medium hover:bg-muted"
                          : "bg-background border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {isPast ? (
                        <CheckIcon className="size-3 text-emerald-500 shrink-0" />
                      ) : (
                        <span
                          className={cn(
                            "size-1.5 rounded-full shrink-0",
                            isCurrent ? "bg-primary-foreground" : stageDotClass(s.color)
                          )}
                        />
                      )}
                      <span className="text-[10px] uppercase tracking-wider opacity-70">
                        {isPast ? "Done" : `Step ${idx + 1}`}
                      </span>
                    </div>
                    <span className="text-xs truncate w-full">
                      {s.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Key Attributes 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-muted/20 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 text-muted-foreground/70" />
                Close Date
              </span>
              <p className="text-xs font-semibold text-foreground mt-1.5 tabular-nums">
                {formatDate(opportunity.closeDate)}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ActivityIcon className="size-3.5 text-muted-foreground/70" />
                Deal Health
              </span>
              <div className="mt-1.5 flex items-center gap-1.5">
                {healthScore === "HEALTHY" ? (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2Icon className="size-3.5" />
                    Healthy
                  </span>
                ) : healthScore === "AT_RISK" ? (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangleIcon className="size-3.5" />
                    At Risk
                  </span>
                ) : healthScore === "CRITICAL" ? (
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <XCircleIcon className="size-3.5" />
                    Critical
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground font-medium">—</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BriefcaseIcon className="size-3.5 text-muted-foreground/70" />
                Brand / DBA
              </span>
              <p className="text-xs font-semibold text-foreground mt-1.5 truncate">
                {opportunity.brandName || "Corporate / Direct"}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ClockIcon className="size-3.5 text-muted-foreground/70" />
                Created Date
              </span>
              <p className="text-xs font-semibold text-foreground mt-1.5 tabular-nums">
                {formatDate(opportunity.createdAt)}
              </p>
            </div>
          </div>

          {/* CPQ Quotes Shortcut Section */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block">
              CPQ & Line Items
            </span>
            <Link href={`/opportunities/${opportunity.id}#cpq`}>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between h-9 text-xs bg-card hover:bg-muted/40 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <TagIcon className="size-3.5 text-muted-foreground" />
                  <span>Configure Products, Quotes & Line Items</span>
                </span>
                <ArrowRightIcon className="size-3.5 text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Pinned Footer Actions */}
        <div className="p-4 px-6 border-t bg-muted/30 shrink-0 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs cursor-pointer"
          >
            Close
          </Button>

          <Link href={`/opportunities/${opportunity.id}`}>
            <Button size="sm" className="text-xs gap-1.5 cursor-pointer shadow-xs">
              <span>Open Opportunity Record</span>
              <ArrowRightIcon className="size-3.5" />
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
