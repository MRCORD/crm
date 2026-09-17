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

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline deal progression across operating brands and direct corporate accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ManagePipelineDialog stages={stages} categories={categories} templates={templates} />
          <CreateOpportunityDialog
            companies={companiesList.map((c) => ({ id: c.id, name: c.name }))}
            brands={brandsList.map((b) => ({ id: b.id, name: b.name }))}
            stages={stages.map((s) => ({ key: s.key, label: s.label }))}
          />
        </div>
      </div>

      {/* Kanban Board */}
      <KanbanBoard
        initialOpportunities={opportunities}
        brands={brandsList}
        stages={stages.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
        categories={categories.map((c) => ({ id: c.id, key: c.key, label: c.label }))}
      />
    </div>
  )
}
