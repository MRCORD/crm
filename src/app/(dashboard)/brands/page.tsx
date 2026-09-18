import { getBrandsPageData } from "@/actions/crm"
import { formatMicros, formatDate } from "@/lib/utils"
import { CreateBrandDialog } from "@/components/brands/create-brand-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BrandsTable } from "@/components/brands/brands-table"
import { BadgeCheckIcon, GlobeIcon, DollarSignIcon, LayersIcon } from "lucide-react"

export default async function BrandsPage() {
  const { brands, summary } = await getBrandsPageData()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Multi-brand holding company entities and subsidiary operating units.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateBrandDialog />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((item) => (
          <Card key={item.brand.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.brand.color || "#06b6d4" }}
                />
                {item.brand.name}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {item.brand.slug}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMicros(item.activePipelineMicros)}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{item.activeDeals} open deals</span>
                <span>Won: {formatMicros(item.wonAmountMicros)} ({item.wonDeals})</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Brands Table with Pagination & Sorting */}
      <BrandsTable brands={brands} />
    </div>
  )
}
