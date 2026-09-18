import Link from "next/link"
import { getPeopleAction, getCompanies } from "@/actions/crm"
import { formatDate } from "@/lib/utils"
import { CreatePersonDialog } from "@/components/people/create-person-dialog"
import { PeopleTable } from "@/components/people/people-table"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "lucide-react"
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [peopleList, companiesList] = await Promise.all([
    getPeopleAction(q),
    getCompanies(),
  ])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">People</h1>
          <p className="text-sm text-muted-foreground">
            Contact directory, leads, and account stakeholders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreatePersonDialog
            companies={companiesList.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <form className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={q || ""}
            placeholder="Search contacts by name or email..."
            className="pl-8"
          />
        </form>
      </div>

      {/* Contacts Table with Pagination & Sorting */}
      <PeopleTable people={peopleList} />
    </div>
  )
}
