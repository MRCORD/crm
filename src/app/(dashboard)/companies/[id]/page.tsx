import Link from "next/link"
import { notFound } from "next/navigation"
import { getCompanyDetail } from "@/actions/crm"
import { formatMicros, formatDate, formatRelativeTime } from "@/lib/utils"
import { stageBadgeClass, buildStageMap } from "@/lib/stage-colors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Building2Icon,
  GlobeIcon,
  ArrowLeftIcon,
  MapPinIcon,
  UsersIcon,
  DollarSignIcon,
  ClockIcon,
  NetworkIcon,
  PlusIcon,
  BriefcaseIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  FileTextIcon,
} from "lucide-react"


export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getCompanyDetail(id)

  if (!data) {
    notFound()
  }

  const { company, opportunities: opps, people: contacts, timeline, hierarchy, stages } = data
  const stageMap = buildStageMap(stages)

  const totalPipeline = opps
    .filter((o) => !stageMap.get(o.stage)?.category.isClosed)
    .reduce((acc, o) => acc + BigInt(o.amountMicros || 0), BigInt(0))

  return (
    <div className="flex flex-col gap-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={<Link href="/companies" />}
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          Companies
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-muted-foreground">
          {company.name}
        </span>
      </div>

      {/* Record Header (Twenty CRM RecordShowPage pattern) */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2Icon className="size-7" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {company.name}
              </h1>
              {company.industry && (
                <Badge variant="secondary">{company.industry}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                {company.visibility}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {company.domainName && (
                <a
                  href={`https://${company.domainName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:underline"
                >
                  <GlobeIcon className="size-3" />
                  {company.domainName}
                </a>
              )}
              {company.addressCity && (
                <span className="flex items-center gap-1">
                  <MapPinIcon className="size-3" />
                  {company.addressCity}
                  {company.addressCountry ? `, ${company.addressCountry}` : ""}
                </span>
              )}
              <span>Added {formatDate(company.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="flex items-center gap-4 divide-x border-t pt-4 sm:border-t-0 sm:pt-0">
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">Annual Revenue</span>
            <span className="text-base font-bold">
              {company.annualRevenueAmountMicros
                ? formatMicros(
                    company.annualRevenueAmountMicros,
                    company.annualRevenueCurrency || undefined
                  )
                : "—"}
            </span>
          </div>
          <div className="flex flex-col pl-4">
            <span className="text-[11px] text-muted-foreground">Open Pipeline</span>
            <span className="text-base font-bold">
              {formatMicros(totalPipeline.toString())}
            </span>
          </div>
          <div className="flex flex-col pl-4">
            <span className="text-[11px] text-muted-foreground">Contacts</span>
            <span className="text-base font-bold">{contacts.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline ({timeline.length})
          </TabsTrigger>
          <TabsTrigger value="opportunities">
            Deals ({opps.length})
          </TabsTrigger>
          <TabsTrigger value="people">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="mt-6 flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Information</CardTitle>
                <CardDescription>
                  Core account attributes and identifiers
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Account Name</span>
                  <span className="font-medium">{company.name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Domain</span>
                  <span>{company.domainName || "—"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Industry</span>
                  <span>{company.industry || "—"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Employees</span>
                  <span>{company.employeesCount?.toLocaleString() || "—"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Location</span>
                  <span>
                    {[
                      company.addressStreet1,
                      company.addressCity,
                      company.addressState,
                      company.addressCountry,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Record ID</span>
                  <code className="text-xs text-muted-foreground">
                    {company.id}
                  </code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custom Fields</CardTitle>
                <CardDescription>
                  Dynamic runtime fields indexed via Polygres
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(company.customFields || {}).length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No custom fields configured for this company.
                  </p>
                ) : (
                  <pre className="max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(company.customFields, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: TIMELINE */}
        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
              <CardDescription>
                Chronological unified event stream (calls, emails, notes, stage changes)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
                  <ClockIcon className="mb-2 size-8 text-muted-foreground/50" />
                  <span>No activity recorded on this company yet.</span>
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

        {/* TAB 3: DEALS */}
        <TabsContent value="opportunities" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Opportunities</CardTitle>
                <CardDescription>All deals linked to this account</CardDescription>
              </div>
              <Button
                size="sm"
                render={<Link href="/opportunities" />}
              >
                <PlusIcon className="mr-1 size-4" />
                Pipeline Board
              </Button>
            </CardHeader>
            <CardContent>
              {opps.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No opportunities created for this account yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opportunity Name</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-center">Probability</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opps.map((opp) => (
                      <TableRow key={opp.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/opportunities/${opp.id}`}
                            className="hover:underline"
                          >
                            {opp.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={stageBadgeClass(stageMap.get(opp.stage)?.color)}
                          >
                            {stageMap.get(opp.stage)?.label ?? opp.stage.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMicros(opp.amountMicros, opp.currency)}
                        </TableCell>
                        <TableCell className="text-center">
                          {opp.probabilityPercent ?? 0}%
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(opp.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: PEOPLE */}
        <TabsContent value="people" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
              <CardDescription>Individuals associated with this company</CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No contacts linked to this company yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">
                          {person.firstName} {person.lastName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {person.jobTitle || "—"}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`mailto:${person.email}`}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <MailIcon className="size-3" />
                            {person.email}
                          </a>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {person.phone ? (
                            <span className="flex items-center gap-1">
                              <PhoneIcon className="size-3" />
                              {person.phone}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: HIERARCHY */}
        <TabsContent value="hierarchy" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Corporate Hierarchy</CardTitle>
              <CardDescription>
                Parent company and subsidiary relationships with family-wide rollup
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hierarchy ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Hierarchy information unavailable.
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Family Rollup Summary */}
                  <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4">
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Family Entities
                      </span>
                      <div className="text-xl font-bold">
                        {hierarchy.rollup.totalFamilyEntities}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Total Contacts
                      </span>
                      <div className="text-xl font-bold">
                        {hierarchy.rollup.totalContacts}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Open Deals
                      </span>
                      <div className="text-xl font-bold">
                        {hierarchy.rollup.totalOpenOpportunities}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Total Family Pipeline
                      </span>
                      <div className="text-xl font-bold">
                        {formatMicros(hierarchy.rollup.totalPipelineAmountMicros)}
                      </div>
                    </div>
                  </div>

                  {/* Ancestor / Parent Section */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Parent Entity
                    </h4>
                    {hierarchy.ancestors.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This is a top-level root organization. No parent company.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {hierarchy.ancestors.map((ancestor) => (
                          <Link
                            key={ancestor.id}
                            href={`/companies/${ancestor.id}`}
                            className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted"
                          >
                            <Building2Icon className="size-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {ancestor.name}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              Parent (Depth {ancestor.depth})
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Descendant Tree */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Subsidiaries
                    </h4>
                    {hierarchy.descendantTree.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No subsidiaries attached to this company.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {hierarchy.descendantTree.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/companies/${sub.id}`}
                            className="flex items-center justify-between rounded-md border p-3 hover:bg-muted"
                          >
                            <div className="flex items-center gap-2">
                              <NetworkIcon className="size-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{sub.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {sub.subsidiaries.length} children
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
