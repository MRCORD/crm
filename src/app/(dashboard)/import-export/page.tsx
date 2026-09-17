import { ImportExportClient } from "@/components/import-export/import-export-client"

export default function ImportExportPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CSV Import &amp; Export</h1>
        <p className="text-sm text-muted-foreground">
          Bulk import or extract structured records for Companies, Contacts, and Opportunities.
        </p>
      </div>

      <ImportExportClient />
    </div>
  )
}
