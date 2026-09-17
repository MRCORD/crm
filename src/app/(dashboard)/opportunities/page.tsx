import { getOpportunities, getCompanies } from "@/actions/crm"
import { listBrands } from "@/lib/brands"
import { KanbanBoard } from "@/components/opportunities/kanban-board"
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog"

export default async function OpportunitiesPage() {
  const [opportunities, companiesList, brandsList] = await Promise.all([
    getOpportunities(),
    getCompanies(),
    listBrands(true),
  ])

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline deal progression across Habladoc, Fudis, and direct corporate accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateOpportunityDialog
            companies={companiesList.map((c) => ({ id: c.id, name: c.name }))}
            brands={brandsList.map((b) => ({ id: b.id, name: b.name }))}
          />
        </div>
      </div>

      {/* Kanban Board */}
      <KanbanBoard
        initialOpportunities={opportunities}
        brands={brandsList}
      />
    </div>
  )
}
