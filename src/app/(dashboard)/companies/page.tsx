import Link from "next/link"
import { getCompanies } from "@/actions/crm"
import { formatMicros, formatDate } from "@/lib/utils"
import { CreateCompanyDialog } from "@/components/companies/create-company-dialog"
import { CompaniesTable } from "@/components/companies/companies-table"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "lucide-react"
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

      {/* Companies Table with Pagination & Sorting */}
      <CompaniesTable companies={companiesList} />
    </div>
  )
}
