import {
  getOpportunities,
  getCompanies,
  getPipelineStagesAction,
  getStageCategoriesAction,
  getPipelineTemplatesAction,
} from "@/actions/crm"
import { listBrands } from "@/lib/brands"
import { KanbanBoard } from "@/components/opportunities/kanban-board"
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog"
import { ManagePipelineDialog } from "@/components/opportunities/manage-pipeline-dialog"
import { Badge } from "@/components/ui/badge"
import { formatMicros } from "@/lib/utils"

export default async function OpportunitiesPage() {
  const [opportunities, companiesList, brandsList, stages, categories, templates] =
    await Promise.all([
      getOpportunities(),
      getCompanies(),
      listBrands(true),
      getPipelineStagesAction(),
      getStageCategoriesAction(),
      getPipelineTemplatesAction(),
    ])

  const totalAmount = opportunities.reduce(
    (sum, o) => sum + BigInt(o.amountMicros || 0),
    BigInt(0)
  )
  const activeDeals = opportunities.filter(
    (o) => !["CLOSED_WON", "CLOSED_LOST"].includes(o.stage)
  ).length
  const wonDeals = opportunities.filter((o) => o.stage === "CLOSED_WON").length

  return (
    <div className="flex flex-col gap-6 w-full max-w-full min-w-0">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Opportunities Portfolio
            </h1>
            <Badge variant="secondary" className="text-xs">
              All Brands
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Consolidated pipeline deal progression across operating brands and corporate accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ManagePipelineDialog
            stages={stages}
            categories={categories}
            templates={templates}
          />
          <CreateOpportunityDialog
            companies={companiesList.map((c) => ({ id: c.id, name: c.name }))}
            brands={brandsList.map((b) => ({ id: b.id, name: b.name }))}
            stages={stages.map((s) => ({ key: s.key, label: s.label }))}
          />
        </div>
      </div>

      {/* Portfolio Quick Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">
            Total Pipeline Value
          </span>
          <p className="text-lg font-bold tracking-tight text-foreground mt-0.5">
            {formatMicros(totalAmount.toString())}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">
            Total Portfolio Deals
          </span>
          <p className="text-lg font-bold tracking-tight text-foreground mt-0.5">
            {opportunities.length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">
            Active Open Deals
          </span>
          <p className="text-lg font-bold tracking-tight text-foreground mt-0.5">
            {activeDeals}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">
            Won Deals
          </span>
          <p className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
            {wonDeals}
          </p>
        </div>
      </div>

      {/* Consolidated Kanban Board */}
      <KanbanBoard
        initialOpportunities={opportunities}
        stages={stages.map((s) => ({
          key: s.key,
          label: s.label,
          color: s.color,
        }))}
        categories={categories.map((c) => ({
          id: c.id,
          key: c.key,
          label: c.label,
        }))}
      />
    </div>
  )
}
