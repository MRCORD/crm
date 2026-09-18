import { getProductsAction } from "@/actions/crm"
import { listBrands } from "@/lib/brands"
import { CreateProductDialog } from "@/components/products/create-product-dialog"
import { ProductsTable } from "@/components/products/products-table"

export default async function ProductsPage() {
  const [productList, brandsList] = await Promise.all([
    getProductsAction(),
    listBrands(true),
  ])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products &amp; Services</h1>
          <p className="text-sm text-muted-foreground">
            Catalog items, SKUs, and default pricing for CPQ line item quoting. Products can be scoped to a specific brand/DBA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateProductDialog
            brands={brandsList.map((b) => ({ id: b.id, name: b.name }))}
          />
        </div>
      </div>

      {/* Table */}
      {/* Products Table with Pagination & Sorting */}
      <ProductsTable products={productList} />
    </div>
  )
}
