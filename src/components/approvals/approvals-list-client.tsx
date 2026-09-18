"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { resolveApprovalAction } from "@/actions/crm"
import { formatDate } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldCheckIcon, CheckIcon, XIcon, Loader2Icon } from "lucide-react"

export function ApprovalsListClient({
  initialApprovals,
}: {
  initialApprovals: any[]
}) {
  const [approvals, setApprovals] = React.useState(initialApprovals)
  const [actingId, setActingId] = React.useState<string | null>(null)
  const router = useRouter()

  async function handleResolve(id: string, status: "APPROVED" | "REJECTED") {
    setActingId(id)
    try {
      await resolveApprovalAction(id, status, "Human Reviewer")
      setApprovals((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status, resolvedAt: new Date() } : a))
      )
      router.refresh()
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Risk Tier</TableHead>
            <TableHead>Target Action</TableHead>
            <TableHead>Target Entity</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead className="text-right">Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {approvals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <ShieldCheckIcon className="size-8 text-muted-foreground/50" />
                  <span>No actions pending human approval.</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            approvals.map((appr) => (
              <TableRow key={appr.id}>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono">
                    Tier {appr.riskTier}
                  </Badge>
                </TableCell>
                <TableCell className="font-semibold text-xs">
                  {appr.actionName}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {appr.targetEntity} #{appr.targetEntityId ? appr.targetEntityId.slice(0, 8) : "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant={
                      appr.status === "PENDING"
                        ? "outline"
                        : appr.status === "APPROVED"
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-xs"
                  >
                    {appr.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(appr.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  {appr.status === "PENDING" ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingId === appr.id}
                        onClick={() => handleResolve(appr.id, "REJECTED")}
                      >
                        <XIcon className="mr-1 size-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={actingId === appr.id}
                        onClick={() => handleResolve(appr.id, "APPROVED")}
                      >
                        {actingId === appr.id ? (
                          <Loader2Icon className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <CheckIcon className="mr-1 size-3.5" />
                        )}
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Resolved {formatDate(appr.resolvedAt)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
