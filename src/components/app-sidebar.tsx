"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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

const data = {
  navMain: [
    { title: "Overview", url: "/", icon: LayoutDashboardIcon },
    { title: "Companies", url: "/companies", icon: Building2Icon },
    { title: "Opportunities", url: "/opportunities", icon: DollarSignIcon },
    { title: "People", url: "/people", icon: UsersIcon },
    { title: "Sequences", url: "/sequences", icon: MailIcon },
    { title: "Lead Routing", url: "/routing", icon: RouteIcon },
    { title: "Duplicates", url: "/duplicates", icon: GitMergeIcon },
    { title: "Products", url: "/products", icon: PackageIcon },
    { title: "Reports", url: "/reports", icon: ChartBarIcon },
  ],
  navSecondary: [
    { title: "Brands", url: "/brands", icon: BadgeCheckIcon },
    { title: "Webhooks", url: "/webhooks", icon: WebhookIcon },
    { title: "Import / Export", url: "/import-export", icon: UploadIcon },
    { title: "Approvals", url: "/approvals", icon: ShieldCheckIcon },
    { title: "Settings", url: "/settings", icon: Settings2Icon },
    { title: "Help", url: "https://github.com/MRCORD/crm", icon: CircleHelpIcon },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/" />}
            >
              <Building2Icon className="size-5!" />
              <span className="text-base font-semibold">Agentic CRM</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
