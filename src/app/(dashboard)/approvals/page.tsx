import { getApprovalsAction } from "@/actions/crm"
import { ApprovalsListClient } from "@/components/approvals/approvals-list-client"
import { ShieldCheckIcon } from "lucide-react"

export default async function ApprovalsPage() {
  const approvals = await getApprovalsAction()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Human-in-the-Loop Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Tier 4 high-risk agent action gate (record merges, CLOSED_WON deals, deletions).
        </p>
      </div>

      <ApprovalsListClient initialApprovals={approvals} />
    </div>
  )
}
