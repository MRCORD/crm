"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
}

export interface NavSectionDef {
  label?: string
  items: NavItem[]
}

/**
 * Renders one labeled (or unlabeled) group of sidebar links.
 * `SidebarGroupLabel` auto-hides when the sidebar is collapsed to icon mode,
 * and `tooltip` on each button surfaces the label on hover in that state.
 */
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
            const isActive = isExternal
              ? false
              : item.url === "/"
                ? pathname === "/"
                : pathname.startsWith(item.url)

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
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
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
