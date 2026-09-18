import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listBrands } from "@/lib/brands"

// Every CRM page renders live Postgres data behind per-request Clerk auth.
// Without this, routes that don't touch a dynamic API (e.g. /opportunities)
// get prerendered at build time and serve a frozen snapshot of the pipeline.
export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const brandsList = await listBrands(true)
  const brands = brandsList.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    color: b.color,
  }))
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" brands={brands} />
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader />
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 min-w-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
