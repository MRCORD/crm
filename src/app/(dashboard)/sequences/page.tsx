import { getSequencesAction } from "@/actions/crm"
import { formatDate } from "@/lib/utils"
import { CreateSequenceDialog } from "@/components/sequences/create-sequence-dialog"
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
import { MailIcon, PlayIcon, CheckCircle2Icon, UsersIcon } from "lucide-react"

export default async function SequencesPage() {
  const { sequences: list, enrollments } = await getSequencesAction()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Outbound Sequences</h1>
          <p className="text-sm text-muted-foreground">
            Multi-step email cadences and automated outreach campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateSequenceDialog />
        </div>
      </div>

      {/* Sequences Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No outbound sequences created yet.
          </div>
        ) : (
          list.map((seq) => (
            <Card key={seq.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant={seq.isActive ? "default" : "outline"} className="text-xs">
                    {seq.isActive ? "Active" : "Paused"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {seq.stepCount} steps
                  </span>
                </div>
                <CardTitle className="text-base mt-2">{seq.name}</CardTitle>
                {seq.description && (
                  <CardDescription className="line-clamp-2">{seq.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground border-t pt-3 flex justify-between">
                <span>{seq.activeEnrollmentsCount} active enrolled</span>
                <span className="font-mono">{seq.id.slice(0, 8)}</span>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Active Enrollments Table */}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Recent Enrollments</h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Sequence</TableHead>
                <TableHead className="text-center">Current Step</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Enrolled At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No contacts enrolled in sequences yet.
                  </TableCell>
                </TableRow>
              ) : (
                enrollments.map((enr) => (
                  <TableRow key={enr.id}>
                    <TableCell className="font-medium">
                      <div>{enr.personName}</div>
                      <div className="text-xs text-muted-foreground">{enr.personEmail}</div>
                    </TableCell>
                    <TableCell>{enr.sequenceName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        Step {enr.currentStep}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {enr.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(enr.enrolledAt)}
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
