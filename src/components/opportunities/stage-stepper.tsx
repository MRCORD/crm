"use client"

import * as React from "react"
import { updateOpportunityStageAction, OpportunityStage } from "@/actions/crm"
import { Button } from "@/components/ui/button"
import { stageSolidClass } from "@/lib/stage-colors"
import { CheckIcon, Loader2Icon } from "lucide-react"

export interface StageStepperStage {
  key: string
  label: string
  color: string
  category: { isClosed: boolean; isWon: boolean; isLost: boolean }
}

export function StageStepper({
  opportunityId,
  currentStage,
  stages,
}: {
  opportunityId: string
  currentStage: string
  stages: StageStepperStage[]
}) {
  const [stage, setStage] = React.useState(currentStage)
  const [loadingStage, setLoadingStage] = React.useState<string | null>(null)

  // Resync local optimistic `stage` when the server-provided `currentStage`
  // prop changes (e.g. after router revalidation), using React's documented
  // "adjust state during render" pattern instead of an effect.
  const [prevCurrentStage, setPrevCurrentStage] = React.useState(currentStage)
  if (currentStage !== prevCurrentStage) {
    setPrevCurrentStage(currentStage)
    setStage(currentStage)
  }

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

  const currentIndex = stages.findIndex((s) => s.key === stage)
  const currentIsClosedLost = stages.find((s) => s.key === stage)?.category.isLost ?? false

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-1.5">
      {stages.map((s, idx) => {
        const isCurrent = s.key === stage
        const isPassed = !currentIsClosedLost && !s.category.isLost && idx < currentIndex

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
            className={`h-8 text-xs font-medium ${isCurrent ? stageSolidClass(s.color) : ""}`}
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
