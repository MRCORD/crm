"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { mergeRecordsAction, dismissCandidateAction } from "@/actions/crm"
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
import { GitMergeIcon, XIcon, Loader2Icon } from "lucide-react"

export function MergeCandidatesList({
  initialCandidates,
}: {
  initialCandidates: any[]
}) {
  const [candidates, setCandidates] = React.useState(initialCandidates)
  const [actingId, setActingId] = React.useState<string | null>(null)
  const router = useRouter()

  async function handleMerge(candidate: any) {
    setActingId(candidate.id)
    try {
      await mergeRecordsAction({
        candidateId: candidate.id,
        entityType: candidate.entityType as any,
        primaryRecordId: candidate.primaryRecordId,
        secondaryRecordId: candidate.secondaryRecordId,
      })
      setCandidates((prev) => prev.filter((c) => c.id !== candidate.id))
      router.refresh()
    } finally {
      setActingId(null)
    }
  }

  async function handleDismiss(candidateId: string) {
    setActingId(candidateId)
    try {
      await dismissCandidateAction(candidateId)
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId))
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
            <TableHead>Entity</TableHead>
            <TableHead>Primary Record</TableHead>
            <TableHead>Duplicate Match</TableHead>
            <TableHead className="text-center">Confidence</TableHead>
            <TableHead>Detected At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-32 text-center text-muted-foreground"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <GitMergeIcon className="size-8 text-muted-foreground/50" />
                  <span>No duplicate records pending review. Clean database!</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            candidates.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {c.entityType}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {c.primaryRecordId.slice(0, 13)}...
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {c.secondaryRecordId.slice(0, 13)}...
                </TableCell>
                <TableCell className="text-center font-semibold">
                  {Math.round((c.confidenceScore || 0) * 100)}%
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(c.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId === c.id}
                      onClick={() => handleDismiss(c.id)}
                    >
                      <XIcon className="mr-1 size-3.5" />
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      disabled={actingId === c.id}
                      onClick={() => handleMerge(c)}
                    >
                      {actingId === c.id ? (
                        <Loader2Icon className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <GitMergeIcon className="mr-1 size-3.5" />
                      )}
                      Merge
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
