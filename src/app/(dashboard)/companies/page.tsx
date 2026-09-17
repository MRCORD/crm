import Link from "next/link"
import { getCompanies } from "@/actions/crm"
import { formatMicros, formatDate } from "@/lib/utils"
import { CreateCompanyDialog } from "@/components/companies/create-company-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Building2Icon,
  GlobeIcon,
  SearchIcon,
  UsersIcon,
  DollarSignIcon,
  BriefcaseIcon,
} from "lucide-react"

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const companiesList = await getCompanies(q)

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Account master directory and client organizational entities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateCompanyDialog />
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-2">
        <form className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={q || ""}
            placeholder="Search companies by name..."
            className="pl-8"
          />
        </form>
      </div>

      {/* Companies Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead className="text-right">Annual Revenue</TableHead>
              <TableHead className="text-center">Deals</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
              <TableHead className="text-center">Contacts</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companiesList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Building2Icon className="size-8 text-muted-foreground/50" />
                    <span>No companies found.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              companiesList.map((company) => (
                <TableRow key={company.id} className="group cursor-pointer">
                  <TableCell className="font-medium">
                    <Link
                      href={`/companies/${company.id}`}
                      className="flex items-center gap-2 text-foreground group-hover:underline"
                    >
                      <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Building2Icon className="size-4" />
                      </div>
                      <span>{company.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {company.domainName ? (
                      <a
                        href={`https://${company.domainName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                      >
                        <GlobeIcon className="size-3" />
                        {company.domainName}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.industry ? (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {company.industry}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {company.annualRevenueAmountMicros
                      ? formatMicros(
                          company.annualRevenueAmountMicros,
                          company.annualRevenueCurrency || undefined
                        )
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">
                      {company.dealCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMicros(company.totalPipelineMicros)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs text-muted-foreground">
                      {company.peopleCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(company.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
