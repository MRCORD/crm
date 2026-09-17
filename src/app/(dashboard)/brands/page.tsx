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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

      {/* Brands Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: b.color || "#06b6d4" }}
                    />
                    <span>{b.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {b.slug}
                </TableCell>
                <TableCell>
                  {b.website ? (
                    <a
                      href={b.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <GlobeIcon className="size-3" />
                      {b.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
                  {b.description || "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={b.isActive ? "secondary" : "outline"} className="text-xs">
                    {b.isActive ? "Active" : "Archived"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(b.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
