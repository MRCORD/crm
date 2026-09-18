import { getDuplicatesAction } from "@/actions/crm"
import { formatDate } from "@/lib/utils"
import { MergeCandidatesList } from "@/components/duplicates/merge-candidates-list"
import { GitMergeIcon } from "lucide-react"

export default async function DuplicatesPage() {
  const candidates = await getDuplicatesAction()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Duplicate Records &amp; Merge Queue</h1>
        <p className="text-sm text-muted-foreground">
          Identified potential duplicate companies and contacts with similarity scoring.
        </p>
      </div>

      <MergeCandidatesList initialCandidates={candidates} />
    </div>
  )
}
