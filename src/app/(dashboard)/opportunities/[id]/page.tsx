import Link from "next/link"
import { notFound } from "next/navigation"
import { getOpportunityDetail } from "@/actions/crm"
import { formatMicros, formatDate, formatRelativeTime } from "@/lib/utils"
import { stageBadgeClass, buildStageMap } from "@/lib/stage-colors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StageStepper } from "@/components/opportunities/stage-stepper"
import { CpqSection } from "@/components/opportunities/cpq-section"
import {
  ArrowLeftIcon,
  Building2Icon,
  DollarSignIcon,
  CalendarIcon,
  ActivityIcon,
  ClockIcon,
  TrendingUpIcon,
} from "lucide-react"

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getOpportunityDetail(id)

  if (!data) {
    notFound()
  }

  const { opportunity: opp, lineItems, quotes, timeline, products, stages } = data
  const stageMap = buildStageMap(stages)

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={<Link href="/opportunities" />}
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          Opportunities
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-muted-foreground truncate max-w-xs">
          {opp.name}
        </span>
      </div>

      {/* Record Header (Twenty CRM RecordShowPage pattern) */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DollarSignIcon className="size-7" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{opp.name}</h1>
              <Badge
                variant="secondary"
                className={stageBadgeClass(stageMap.get(opp.stage)?.color)}
              >
                {stageMap.get(opp.stage)?.label ?? opp.stage.replace("_", " ")}
              </Badge>
              {opp.brandName && (
                <Badge
                  variant="outline"
                  className="text-[10px]"
                  style={{
                    borderColor: opp.brandColor || undefined,
                    color: opp.brandColor || undefined,
                  }}
                >
                  {opp.brandName}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <Link
                href={`/companies/${opp.companyId}`}
                className="flex items-center gap-1 hover:underline text-foreground"
              >
                <Building2Icon className="size-3 text-muted-foreground" />
                {opp.companyName}
              </Link>
              {opp.closeDate && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="size-3" />
                  Target Close: {formatDate(opp.closeDate)}
                </span>
              )}
              <span>Created {formatDate(opp.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Amount & KPI Strip */}
        <div className="flex items-center gap-4 divide-x border-t pt-4 sm:border-t-0 sm:pt-0">
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">Deal Amount</span>
            <span className="text-2xl font-bold">
              {formatMicros(opp.amountMicros, opp.currency)}
            </span>
          </div>
          <div className="flex flex-col pl-4">
            <span className="text-[11px] text-muted-foreground">Probability</span>
            <span className="text-base font-bold">
              {opp.probabilityPercent ?? 0}%
            </span>
          </div>
          <div className="flex flex-col pl-4">
            <span className="text-[11px] text-muted-foreground">Health Score</span>
            <span className="text-base font-bold">
              {opp.healthScore ? Number(opp.healthScore).toFixed(2) : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Stage Progression Stepper */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sales Stage Progression
        </span>
        <StageStepper opportunityId={opp.id} currentStage={opp.stage} stages={stages} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cpq" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="cpq">
            CPQ &amp; Quotes ({lineItems.length} items, {quotes.length} quotes)
          </TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline ({timeline.length})
          </TabsTrigger>
          <TabsTrigger value="overview">Deal Overview</TabsTrigger>
        </TabsList>

        {/* TAB 1: CPQ & QUOTES */}
        <TabsContent value="cpq" className="mt-6">
          <CpqSection
            opportunityId={opp.id}
            lineItems={lineItems}
            quotes={quotes}
            products={products}
          />
        </TabsContent>

        {/* TAB 2: TIMELINE */}
        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opportunity Activity History</CardTitle>
              <CardDescription>
                Chronological log of stage changes, quotes, and communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
                  <ClockIcon className="mb-2 size-8 text-muted-foreground/50" />
                  <span>No activities logged on this deal yet.</span>
                </div>
              ) : (
                <div className="relative border-l border-muted-foreground/20 pl-6 ml-2 space-y-6">
                  {timeline.map((event) => (
                    <div key={event.id} className="relative">
                      <span className="absolute -left-[31px] top-1 flex size-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {event.activityType.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(event.happenedAt)}
                          </span>
                          {event.actorName && (
                            <span className="text-xs text-muted-foreground/70">
                              by {event.actorName} ({event.actorSource})
                            </span>
                          )}
                        </div>
                        {typeof event.properties === "object" && event.properties !== null && Object.keys(event.properties).length > 0 && (
                          <div className="mt-1 rounded-md bg-muted/40 p-2 text-xs">
                            <pre className="text-xs text-muted-foreground">
                              {JSON.stringify(event.properties, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: OVERVIEW */}
        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal Attributes</CardTitle>
              <CardDescription>Opportunity properties and system identifiers</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Opportunity Name</span>
                <span className="font-medium">{opp.name}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Company</span>
                <Link
                  href={`/companies/${opp.companyId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {opp.companyName}
                </Link>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">
                  {formatMicros(opp.amountMicros, opp.currency)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Currency</span>
                <span>{opp.currency}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Stage</span>
                <Badge
                  variant="outline"
                  className={stageBadgeClass(stageMap.get(opp.stage)?.color)}
                >
                  {stageMap.get(opp.stage)?.label ?? opp.stage.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Probability</span>
                <span>{opp.probabilityPercent ?? 0}%</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Target Close</span>
                <span>{formatDate(opp.closeDate)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Brand / DBA</span>
                <span>{opp.brandName || "General Mysios Labs"}</span>
              </div>
              {opp.lossReason && (
                <div className="flex justify-between border-b pb-2 col-span-2 text-destructive">
                  <span>Loss Reason</span>
                  <span>{opp.lossReason}</span>
                </div>
              )}
              <div className="flex justify-between col-span-2 pt-2 text-xs text-muted-foreground">
                <span>Record ID</span>
                <code>{opp.id}</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
