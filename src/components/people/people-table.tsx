"use client"

import * as React from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TablePagination } from "@/components/ui/table-pagination"
import { formatDate } from "@/lib/utils"
import {
  UsersIcon,
  MailIcon,
  PhoneIcon,
  Building2Icon,
  ArrowUpDownIcon,
} from "lucide-react"

export interface PersonRow {
  id: string
  firstName: string | null
  lastName: string | null
  jobTitle: string | null
  email: string
  phone: string | null
  companyId: string | null
  companyName: string | null
  createdAt: Date
}

type SortField = "name" | "title" | "company" | "email" | "createdAt"
type SortOrder = "asc" | "desc"

export function PeopleTable({
  people,
}: {
  people: PersonRow[]
}) {
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [pageSize, setPageSize] = React.useState<number>(10)
  const [sortField, setSortField] = React.useState<SortField>("name")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc")

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const sortedPeople = React.useMemo(() => {
    const list = [...people]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === "name") {
        const aName = `${a.firstName} ${a.lastName || ""}`.trim()
        const bName = `${b.firstName} ${b.lastName || ""}`.trim()
        comparison = aName.localeCompare(bName)
      } else if (sortField === "title") {
        comparison = (a.jobTitle || "").localeCompare(b.jobTitle || "")
      } else if (sortField === "company") {
        comparison = (a.companyName || "").localeCompare(b.companyName || "")
      } else if (sortField === "email") {
        comparison = a.email.localeCompare(b.email)
      } else if (sortField === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
    return list
  }, [people, sortField, sortOrder])

  const totalItems = sortedPeople.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const paginatedPeople = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedPeople.slice(start, start + pageSize)
  }, [sortedPeople, currentPage, pageSize])

  return (
    <div className="w-full min-w-full rounded-xl border bg-card shadow-2xs overflow-hidden">
      <div className="w-full overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-muted/30 border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[200px]"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  <span>Contact Name</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[140px]"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center gap-1">
                  <span>Title</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[160px]"
                onClick={() => handleSort("company")}
              >
                <div className="flex items-center gap-1">
                  <span>Company</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[180px]"
                onClick={() => handleSort("email")}
              >
                <div className="flex items-center gap-1">
                  <span>Email</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>

              <TableHead className="py-3 text-xs font-semibold min-w-[130px]">
                Phone
              </TableHead>

              <TableHead
                className="cursor-pointer select-none py-3 text-xs font-semibold hover:text-foreground min-w-[110px]"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center gap-1">
                  <span>Created</span>
                  <ArrowUpDownIcon className="size-3 text-muted-foreground/70" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedPeople.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UsersIcon className="size-8 text-muted-foreground/40" />
                    <span className="text-xs">No contacts found.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedPeople.map((person) => (
                <TableRow key={person.id} className="hover:bg-muted/35 transition-colors border-b border-border/40">
                  <TableCell className="font-medium py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary shrink-0">
                        {person.firstName ? person.firstName[0] : "?"}
                        {person.lastName ? person.lastName[0] : ""}
                      </div>
                      <span className="font-semibold text-xs text-foreground">
                        {person.firstName} {person.lastName || ""}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground py-3">
                    {person.jobTitle || "—"}
                  </TableCell>

                  <TableCell className="py-3">
                    {person.companyId && person.companyName ? (
                      <Link
                        href={`/companies/${person.companyId}`}
                        className="flex items-center gap-1 text-xs text-primary hover:underline w-fit"
                      >
                        <Building2Icon className="size-3 text-muted-foreground shrink-0" />
                        <span>{person.companyName}</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>

                  <TableCell className="py-3">
                    <a
                      href={`mailto:${person.email}`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline w-fit"
                    >
                      <MailIcon className="size-3 shrink-0" />
                      <span>{person.email}</span>
                    </a>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground py-3 tabular-nums">
                    {person.phone ? (
                      <span className="flex items-center gap-1">
                        <PhoneIcon className="size-3 shrink-0" />
                        <span>{person.phone}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground py-3 tabular-nums">
                    {formatDate(person.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        totalItems={totalItems}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        itemLabel="contacts"
      />
    </div>
  )
}
