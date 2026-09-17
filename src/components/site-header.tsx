"use client"

import { usePathname } from "next/navigation"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/companies", title: "Companies" },
  { prefix: "/opportunities", title: "Opportunities" },
  { prefix: "/people", title: "People" },
  { prefix: "/sequences", title: "Sequences" },
  { prefix: "/routing", title: "Lead Routing" },
  { prefix: "/duplicates", title: "Duplicates" },
  { prefix: "/products", title: "Products" },
  { prefix: "/reports", title: "Reports" },
  { prefix: "/brands", title: "Brands" },
  { prefix: "/webhooks", title: "Webhooks" },
  { prefix: "/import-export", title: "Import / Export" },
  { prefix: "/approvals", title: "Approvals" },
  { prefix: "/settings", title: "Settings" },
]

function titleForPath(pathname: string): string {
  if (pathname === "/") return "Overview"
  const match = TITLES.find((entry) => pathname.startsWith(entry.prefix))
  return match?.title ?? "Mysios CRM"
}

export function SiteHeader() {
  const pathname = usePathname()
  const title = titleForPath(pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{title}</h1>
      </div>
    </header>
  )
}
