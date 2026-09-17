import Link from "next/link"
import { getPeopleAction, getCompanies } from "@/actions/crm"
import { formatDate } from "@/lib/utils"
import { CreatePersonDialog } from "@/components/people/create-person-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  UsersIcon,
  MailIcon,
  PhoneIcon,
  Building2Icon,
  SearchIcon,
} from "lucide-react"

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

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {peopleList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UsersIcon className="size-8 text-muted-foreground/50" />
                    <span>No contacts found.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              peopleList.map((person) => (
                <TableRow key={person.id} className="group">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {person.firstName ? person.firstName[0] : "?"}
                        {person.lastName ? person.lastName[0] : ""}
                      </div>
                      <span>
                        {person.firstName} {person.lastName || ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {person.jobTitle || "—"}
                  </TableCell>
                  <TableCell>
                    {person.companyId && person.companyName ? (
                      <Link
                        href={`/companies/${person.companyId}`}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Building2Icon className="size-3 text-muted-foreground" />
                        {person.companyName}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`mailto:${person.email}`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
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
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(person.createdAt)}
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
