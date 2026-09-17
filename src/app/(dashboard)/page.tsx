import Link from "next/link"
import { getDashboardData } from "@/actions/crm"
import { formatMicros, formatDate } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DollarSignIcon,
  TrendingUpIcon,
  Building2Icon,
  ArrowRightIcon,
  LayersIcon,
} from "lucide-react"

const STAGE_COLORS: Record<string, string> = {
  DISCOVERY: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  PROPOSAL: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  NEGOTIATION: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CLOSED_WON: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  CLOSED_LOST: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
}

export default async function DashboardPage() {
  const { funnel, brandSummary, recentOpportunities, recentCompanies } =
    await getDashboardData()

  const habladoc = brandSummary.find((b) => b.brand.slug === "habladoc")
  const fudis = brandSummary.find((b) => b.brand.slug === "fudis")

  const activeDealsCount = funnel.stages
    .filter((s) => !["CLOSED_WON", "CLOSED_LOST"].includes(s.stage))
    .reduce((acc, s) => acc + s.count, 0)

  const wonDealsValue =
    funnel.stages.find((s) => s.stage === "CLOSED_WON")?.totalAmountMicros || "0"

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Holding company portfolio pipeline across Habladoc, Fudis, and Mysios Labs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" render={<Link href="/companies" />}>
            <Building2Icon className="mr-1 size-4" />
            Companies
          </Button>
          <Button size="sm" render={<Link href="/opportunities" />}>
            <LayersIcon className="mr-1 size-4" />
            Pipeline Board
          </Button>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pipeline</CardTitle>
            <DollarSignIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMicros(funnel.summary.activePipelineMicros)}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeDealsCount} open opportunities across stages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed Won</CardTitle>
            <TrendingUpIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMicros(wonDealsValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {funnel.stages.find((s) => s.stage === "CLOSED_WON")?.count ?? 0} deals won all-time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Habladoc (Telehealth)</CardTitle>
            <span className="size-2 rounded-full bg-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMicros(habladoc?.activePipelineMicros || "0")}
            </div>
            <p className="text-xs text-muted-foreground">
              {habladoc?.activeDeals ?? 0} active deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fudis (F&amp;B)</CardTitle>
            <span className="size-2 rounded-full bg-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMicros(fudis?.activePipelineMicros || "0")}
            </div>
            <p className="text-xs text-muted-foreground">
              {fudis?.activeDeals ?? 0} active deals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Funnel Stages Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Stage Funnel</CardTitle>
          <CardDescription>
            Current opportunity distribution by sales stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {funnel.stages.map((stage) => {
              const badgeClass =
                STAGE_COLORS[stage.stage] || "bg-muted text-foreground"
              return (
                <div
                  key={stage.stage}
                  className="flex flex-col justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {stage.stage.replace("_", " ")}
                    </span>
                    <Badge variant="secondary" className={badgeClass}>
                      {stage.count}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="text-lg font-bold">
                      {formatMicros(stage.totalAmountMicros)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Section: Recent Opportunities & Recent Companies */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Recent Opportunities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Deals</CardTitle>
              <CardDescription>Latest pipeline additions and updates</CardDescription>
            </div>
            <Button size="sm" variant="ghost" render={<Link href="/opportunities" />}>
              View Board <ArrowRightIcon className="ml-1 size-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recentOpportunities.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No opportunities yet.
                </p>
              ) : (
                recentOpportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/opportunities/${opp.id}`}
                    className="flex items-center justify-between py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium hover:underline">
                        {opp.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {opp.companyName}
                        {opp.brandName ? ` • ${opp.brandName}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold">
                          {formatMicros(opp.amountMicros)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STAGE_COLORS[opp.stage] || ""}`}
                        >
                          {opp.stage.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Recent Companies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Accounts</CardTitle>
              <CardDescription>Managed companies and client entities</CardDescription>
            </div>
            <Button size="sm" variant="ghost" render={<Link href="/companies" />}>
              View All <ArrowRightIcon className="ml-1 size-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recentCompanies.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No companies yet.
                </p>
              ) : (
                recentCompanies.map((c) => (
                  <Link
                    key={c.id}
                    href={`/companies/${c.id}`}
                    className="flex items-center justify-between py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium hover:underline">
                        {c.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.domainName || "No domain"} • {c.industry || "General"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Added {formatDate(c.createdAt)}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
