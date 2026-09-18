"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavSubItem {
  title: string
  url: string
  color?: string | null
}

export interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  items?: NavSubItem[]
}

export interface NavSectionDef {
  label?: string
  items: NavItem[]
}

export function NavSection({
  section,
  className,
}: {
  section: NavSectionDef
  className?: string
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup className={className}>
      {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {section.items.map((item) => {
            const isExternal = item.url.startsWith("http")
            const hasSub = Boolean(item.items && item.items.length > 0)
            const isSelfActive =
              item.url === "/" ? pathname === "/" : pathname === item.url
            const isAnySubActive = Boolean(
              item.items?.some((s) => pathname === s.url)
            )

            if (!hasSub) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isSelfActive}
                    render={
                      isExternal ? (
                        <a href={item.url} target="_blank" rel="noreferrer" />
                      ) : (
                        <Link href={item.url} />
                      )
                    }
                  >
                    {item.icon ? <item.icon /> : null}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            return (
              <CollapsibleNavItem
                key={item.title}
                item={item}
                pathname={pathname}
                isSelfActive={isSelfActive}
                isAnySubActive={isAnySubActive}
              />
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function CollapsibleNavItem({
  item,
  pathname,
  isSelfActive,
  isAnySubActive,
}: {
  item: NavItem
  pathname: string
  isSelfActive: boolean
  isAnySubActive: boolean
}) {
  const [open, setOpen] = React.useState(isSelfActive || isAnySubActive)

  return (
    <SidebarMenuItem>
      <div className="flex items-center w-full group-data-[collapsible=icon]:block">
        <SidebarMenuButton
          tooltip={item.title}
          isActive={isSelfActive && !isAnySubActive}
          className="flex-1 pr-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:pr-0"
          render={<Link href={item.url} />}
        >
          {item.icon ? <item.icon /> : null}
          <span>{item.title}</span>
        </SidebarMenuButton>
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => setOpen((prev) => !prev)}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors mr-1 group-data-[collapsible=icon]:hidden"
          aria-label={`Toggle ${item.title}`}
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 transition-transform duration-200",
              open && "rotate-90"
            )}
          />
        </button>
      </div>

      <ul
        className={cn(
          "mx-3.5 flex min-w-0 flex-col gap-1 border-l border-sidebar-border px-2.5 py-1 group-data-[collapsible=icon]:hidden",
          !open && "hidden"
        )}
      >
        {item.items?.map((sub) => {
            const active = pathname === sub.url
            return (
              <li key={sub.url} className="relative">
                <Link
                  href={sub.url}
                  className={cn(
                    "flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-xs transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {sub.color && (
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: sub.color }}
                    />
                  )}
                  <span className="truncate">{sub.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
    </SidebarMenuItem>
  )
}
