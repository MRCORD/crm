import { getWebhooksPageData } from "@/actions/crm"
import { formatDate } from "@/lib/utils"
import { CreateWebhookDialog } from "@/components/webhooks/create-webhook-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { WebhookIcon } from "lucide-react"

export default async function WebhooksPage() {
  const { subscriptions, deliveries } = await getWebhooksPageData()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Outbound Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Event triggers and HTTP delivery audit log for third-party integrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateWebhookDialog />
        </div>
      </div>

      {/* Subscriptions */}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Active Subscriptions</h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target URL</TableHead>
                <TableHead>Subscribed Events</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No webhook subscriptions registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-mono text-xs max-w-sm truncate">
                      {sub.targetUrl}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {sub.eventTypes.map((ev: string) => (
                          <Badge key={ev} variant="outline" className="text-[10px]">
                            {ev}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sub.name || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sub.isActive ? "secondary" : "outline"} className="text-xs">
                        {sub.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(sub.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Recent Deliveries */}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Delivery Audit Log</h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Type</TableHead>
                <TableHead className="text-center">HTTP Status</TableHead>
                <TableHead>Delivered At</TableHead>
                <TableHead className="text-right">Response Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                    No deliveries logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                deliveries.map((del) => (
                  <TableRow key={del.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {del.eventType}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={del.responseStatusCode && del.responseStatusCode < 300 ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {del.responseStatusCode || del.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(del.createdAt)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {del.attempts} attempt(s)
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
