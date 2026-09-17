"use client"

import * as React from "react"
import { updateOpportunityStageAction, OpportunityStage } from "@/actions/crm"
import { Button } from "@/components/ui/button"
import { CheckIcon, Loader2Icon } from "lucide-react"

const STAGES: { key: OpportunityStage; label: string }[] = [
  { key: "DISCOVERY", label: "Discovery" },
  { key: "PROPOSAL", label: "Proposal" },
  { key: "NEGOTIATION", label: "Negotiation" },
  { key: "CLOSED_WON", label: "Closed Won" },
  { key: "CLOSED_LOST", label: "Closed Lost" },
]

export function StageStepper({
  opportunityId,
  currentStage,
}: {
  opportunityId: string
  currentStage: string
}) {
  const [stage, setStage] = React.useState(currentStage)
  const [loadingStage, setLoadingStage] = React.useState<string | null>(null)

  React.useEffect(() => {
    setStage(currentStage)
  }, [currentStage])

  async function handleSelectStage(newStage: OpportunityStage) {
    if (newStage === stage) return
    setLoadingStage(newStage)
    setStage(newStage)

    try {
      await updateOpportunityStageAction(
        opportunityId,
        newStage,
        "Stage changed via Opportunity Detail Stepper"
      )
    } finally {
      setLoadingStage(null)
    }
  }

  const currentIndex = STAGES.findIndex((s) => s.key === stage)

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-1.5">
      {STAGES.map((s, idx) => {
        const isCurrent = s.key === stage
        const isPassed =
          stage !== "CLOSED_LOST" &&
          s.key !== "CLOSED_LOST" &&
          idx < currentIndex

        let variant: "default" | "secondary" | "outline" = "outline"
        if (isCurrent) {
          variant = "default"
        } else if (isPassed) {
          variant = "secondary"
        }

        return (
          <Button
            key={s.key}
            size="sm"
            variant={variant}
            disabled={loadingStage !== null}
            onClick={() => handleSelectStage(s.key)}
            className={`h-8 text-xs font-medium ${
              isCurrent
                ? s.key === "CLOSED_WON"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : s.key === "CLOSED_LOST"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : ""
                : ""
            }`}
          >
            {loadingStage === s.key ? (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            ) : isPassed ? (
              <CheckIcon className="mr-1 size-3 text-muted-foreground" />
            ) : null}
            {s.label}
          </Button>
        )
      })}
    </div>
  )
}
