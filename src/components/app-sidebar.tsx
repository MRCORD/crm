"use client"

import * as React from "react"
import Link from "next/link"

import { NavSection, type NavSectionDef } from "@/components/nav-section"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  Building2Icon,
  UsersIcon,
  DollarSignIcon,
  MailIcon,
  RouteIcon,
  GitMergeIcon,
  PackageIcon,
  ChartBarIcon,
  WebhookIcon,
  UploadIcon,
  ShieldCheckIcon,
  Settings2Icon,
  CircleHelpIcon,
  BadgeCheckIcon,
} from "lucide-react"

export interface SidebarBrand {
  id: string
  name: string
  slug: string
  color?: string | null
}

function buildNavSections(brands: SidebarBrand[] = []): NavSectionDef[] {
  return [
    {
      items: [{ title: "Overview", url: "/", icon: LayoutDashboardIcon }],
    },
    {
      label: "Pipeline",
      items: [
        { title: "Companies", url: "/companies", icon: Building2Icon },
        {
          title: "Opportunities",
          url: "/opportunities",
          icon: DollarSignIcon,
          items: [
            ...brands.map((b) => ({
              title: b.name,
              url: `/opportunities/brand/${b.slug}`,
              color: b.color,
            })),
            {
              title: "Corporate / Direct",
              url: "/opportunities/brand/direct",
              color: "#6b7280",
            },
          ],
        },
        { title: "People", url: "/people", icon: UsersIcon },
      ],
    },
    {
      label: "Automation",
      items: [
        { title: "Sequences", url: "/sequences", icon: MailIcon },
        { title: "Lead Routing", url: "/routing", icon: RouteIcon },
      ],
    },
    {
      label: "Revenue",
      items: [
        { title: "Products", url: "/products", icon: PackageIcon },
        { title: "Reports", url: "/reports", icon: ChartBarIcon },
      ],
    },
    {
      label: "Data",
      items: [
        { title: "Duplicates", url: "/duplicates", icon: GitMergeIcon },
        { title: "Import / Export", url: "/import-export", icon: UploadIcon },
      ],
    },
  ]
}
// Bottom-pinned: infrequent, ops/governance surfaces (mt-auto on the first
// one pushes it and everything after it to the bottom of SidebarContent).
const workspaceSection: NavSectionDef = {
  label: "Workspace",
  items: [
    { title: "Brands", url: "/brands", icon: BadgeCheckIcon },
    { title: "Webhooks", url: "/webhooks", icon: WebhookIcon },
    { title: "Approvals", url: "/approvals", icon: ShieldCheckIcon },
    { title: "Settings", url: "/settings", icon: Settings2Icon },
  ],
}

const helpSection: NavSectionDef = {
  items: [{ title: "Help", url: "https://github.com/MRCORD/crm", icon: CircleHelpIcon }],
}

export function AppSidebar({
  brands = [],
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  brands?: SidebarBrand[]
}) {
  const navSections = React.useMemo(() => buildNavSections(brands), [brands])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <Building2Icon className="size-5!" />
              <span className="text-base font-semibold group-data-[collapsible=icon]:hidden">
                Agentic CRM
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section, i) => (
          <NavSection key={section.label ?? `section-${i}`} section={section} />
        ))}
        <NavSection section={workspaceSection} className="mt-auto" />
        <NavSection section={helpSection} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
