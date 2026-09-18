import { getRoutingRulesAction } from "@/actions/crm"
import { formatDate } from "@/lib/utils"
import { CreateRoutingRuleDialog } from "@/components/routing/create-routing-rule-dialog"
import { RoutingTable } from "@/components/routing/routing-table"

export default async function RoutingPage() {
  const rules = await getRoutingRulesAction()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Routing Rules</h1>
          <p className="text-sm text-muted-foreground">
            Automated assignment rules (Round Robin, Load Balanced, Territory-based).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateRoutingRuleDialog />
        </div>
      </div>

      {/* Rules Table with Pagination & Sorting */}
      <RoutingTable rules={rules} />
    </div>
  )
}
