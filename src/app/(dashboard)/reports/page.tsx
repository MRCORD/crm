import { getReportsData } from "@/actions/crm"
import { formatMicros } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartBarIcon,
  TrendingUpIcon,
  ClockIcon,
  UsersIcon,
} from "lucide-react"

export default async function ReportsPage() {
  const { funnel, repPerf, velocity, engagement } = await getReportsData()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics &amp; Reports</h1>
        <p className="text-sm text-muted-foreground">
          Sales pipeline conversion, account executive quota pacing, and deal velocity metrics.
        </p>
      </div>

      {/* Top 3 KPI Summaries */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUpIcon className="size-4 text-muted-foreground" />
              Active Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMicros(funnel.summary.activePipelineMicros)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {funnel.summary.totalActiveStages} active progression stages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClockIcon className="size-4 text-muted-foreground" />
              Average Sales Cycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {velocity.closedWonSummary?.avgDaysToClose ? `${Math.round(Number(velocity.closedWonSummary.avgDaysToClose))} days` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From Discovery creation to Closed Won
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UsersIcon className="size-4 text-muted-foreground" />
              Active Sales Reps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {repPerf.reps.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Owners managing live pipeline deals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rep Performance Table */}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Account Executive Performance</h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sales Rep / Owner</TableHead>
                <TableHead className="text-center">Total Deals</TableHead>
                <TableHead className="text-center">Won Deals</TableHead>
                <TableHead className="text-center">Win Rate</TableHead>
                <TableHead className="text-right">Won Volume</TableHead>
                <TableHead className="text-right">Active Pipeline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repPerf.reps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No individual rep metrics tracked yet.
                  </TableCell>
                </TableRow>
              ) : (
                repPerf.reps.map((rep) => (
                  <TableRow key={rep.ownerId || "unassigned"}>
                    <TableCell className="font-medium">
                      {rep.ownerId || "Unassigned"}
                    </TableCell>
                    <TableCell className="text-center">{rep.total}</TableCell>
                    <TableCell className="text-center font-semibold text-emerald-600">
                      {rep.won}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {Math.round(Number(rep.winRatePercent))}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMicros(rep.wonAmountMicros)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMicros(rep.activePipelineMicros)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
