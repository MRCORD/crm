import { getRoutingRulesAction } from "@/actions/crm"
import { formatDate } from "@/lib/utils"
import { CreateRoutingRuleDialog } from "@/components/routing/create-routing-rule-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RouteIcon } from "lucide-react"

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

      {/* Rules Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Priority</TableHead>
              <TableHead>Rule Name</TableHead>
              <TableHead>Target Entity</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead className="text-center">Assignees</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RouteIcon className="size-8 text-muted-foreground/50" />
                    <span>No assignment rules configured.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-mono text-xs font-semibold">
                    #{rule.priority}
                  </TableCell>
                  <TableCell className="font-medium">
                    {rule.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {rule.targetEntity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {rule.assignmentStrategy.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {rule.candidateUserIds.length} users
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={rule.isActive ? "default" : "outline"} className="text-xs">
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(rule.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
