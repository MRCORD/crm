"use client"

import * as React from "react"
import { exportCsvAction, importCsvAction } from "@/actions/crm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DownloadIcon, UploadIcon, Loader2Icon } from "lucide-react"

export function ImportExportClient() {
  const [exportEntity, setExportEntity] = React.useState<"companies" | "people" | "opportunities">("companies")
  const [importEntity, setImportEntity] = React.useState<"companies" | "people" | "opportunities">("companies")
  const [csvInput, setCsvInput] = React.useState("")
  const [loadingExport, setLoadingExport] = React.useState(false)
  const [loadingImport, setLoadingImport] = React.useState(false)
  const [importResult, setImportResult] = React.useState<any>(null)

  async function handleExport() {
    setLoadingExport(true)
    try {
      const csvString = await exportCsvAction(exportEntity)
      const blob = new Blob([csvString], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${exportEntity}-export.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoadingExport(false)
    }
  }

  async function handleImport() {
    if (!csvInput.trim()) return
    setLoadingImport(true)
    setImportResult(null)
    try {
      const res = await importCsvAction(importEntity, csvInput)
      setImportResult(res)
    } finally {
      setLoadingImport(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Export Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DownloadIcon className="size-4" />
            Export Records
          </CardTitle>
          <CardDescription>
            Download full entity datasets as CSV spreadsheets
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <label className="text-xs font-medium">Select Target Entity</label>
            <Select
              value={exportEntity}
              onValueChange={(val) => setExportEntity((val as any) ?? "companies")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="companies">Companies</SelectItem>
                <SelectItem value="people">People (Contacts)</SelectItem>
                <SelectItem value="opportunities">Opportunities</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleExport} disabled={loadingExport}>
            {loadingExport && <Loader2Icon className="mr-1 size-4 animate-spin" />}
            Download CSV
          </Button>
        </CardContent>
      </Card>

      {/* Import Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UploadIcon className="size-4" />
            Bulk CSV Import
          </CardTitle>
          <CardDescription>
            Paste comma-separated rows with header column names
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <label className="text-xs font-medium">Target Entity</label>
            <Select
              value={importEntity}
              onValueChange={(val) => setImportEntity((val as any) ?? "companies")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="companies">Companies</SelectItem>
                <SelectItem value="people">People (Contacts)</SelectItem>
                <SelectItem value="opportunities">Opportunities</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-medium">CSV Content</label>
            <Textarea
              rows={6}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder="name,domain,industry&#10;Acme Health,acmehealth.com,Healthcare&#10;Stark Logistics,stark.io,Logistics"
              className="font-mono text-xs"
            />
          </div>

          <Button onClick={handleImport} disabled={loadingImport || !csvInput.trim()}>
            {loadingImport && <Loader2Icon className="mr-1 size-4 animate-spin" />}
            Run Import
          </Button>

          {importResult && (
            <div className="rounded-md bg-muted p-3 text-xs">
              <span className="font-semibold">Import Complete:</span>{" "}
              {importResult.createdCount ?? importResult.importedCount ?? 0} records processed.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
