"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  createTagAction,
  createCustomFieldAction,
  setFieldPermissionAction,
} from "@/actions/crm"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ShieldCheckIcon,
  TagsIcon,
  DatabaseIcon,
  ColumnsIcon,
  PlusIcon,
  Loader2Icon,
} from "lucide-react"

export function SettingsClient({ initialData }: { initialData: any }) {
  const router = useRouter()
  const { permissions, customFields, customObjects, tags } = initialData

  // Tag creation state
  const [tagName, setTagName] = React.useState("")
  const [tagColor, setTagColor] = React.useState("#6366f1")
  const [tagLoading, setTagLoading] = React.useState(false)

  // Custom field state
  const [cfTarget, setCfTarget] = React.useState("companies")
  const [cfName, setCfName] = React.useState("")
  const [cfLabel, setCfLabel] = React.useState("")
  const [cfType, setCfType] = React.useState<any>("TEXT")
  const [cfLoading, setCfLoading] = React.useState(false)

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault()
    if (!tagName.trim()) return
    setTagLoading(true)
    try {
      await createTagAction(tagName.trim(), tagColor)
      setTagName("")
      router.refresh()
    } finally {
      setTagLoading(false)
    }
  }

  async function handleCreateCustomField(e: React.FormEvent) {
    e.preventDefault()
    if (!cfName.trim() || !cfLabel.trim()) return
    setCfLoading(true)
    try {
      await createCustomFieldAction({
        targetEntity: cfTarget,
        name: cfName.trim(),
        label: cfLabel.trim(),
        fieldType: cfType,
      })
      setCfName("")
      setCfLabel("")
      router.refresh()
    } finally {
      setCfLoading(false)
    }
  }

  return (
    <Tabs defaultValue="permissions" className="w-full">
      <TabsList className="grid w-full grid-cols-4 sm:w-auto">
        <TabsTrigger value="permissions">Permissions</TabsTrigger>
        <TabsTrigger value="custom-fields">Custom Fields ({customFields.length})</TabsTrigger>
        <TabsTrigger value="custom-objects">Custom Objects ({customObjects.length})</TabsTrigger>
        <TabsTrigger value="tags">Tags ({tags.length})</TabsTrigger>
      </TabsList>

      {/* TAB 1: PERMISSIONS */}
      <TabsContent value="permissions" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheckIcon className="size-4" />
              Field-Level Access Control
            </CardTitle>
            <CardDescription>
              Role-based granular field permissions for reps, managers, and admins
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Can Read</TableHead>
                  <TableHead className="text-center">Can Write</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No explicit field overrides configured. Default open permissions apply.
                    </TableCell>
                  </TableRow>
                ) : (
                  permissions.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.entityType}</TableCell>
                      <TableCell className="font-mono text-xs">{p.fieldName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{p.role}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{p.canRead ? "✓" : "—"}</TableCell>
                      <TableCell className="text-center">{p.canWrite ? "✓" : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* TAB 2: CUSTOM FIELDS */}
      <TabsContent value="custom-fields" className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ColumnsIcon className="size-4" />
              Define Runtime Dynamic Field
            </CardTitle>
            <CardDescription>
              Custom schema-less fields indexed automatically via Polygres JSONB paths
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCustomField} className="grid gap-4 sm:grid-cols-4 items-end">
              <div className="grid gap-2">
                <Label>Target Entity</Label>
                <Select value={cfTarget} onValueChange={(val) => setCfTarget(val ?? "companies")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="companies">Companies</SelectItem>
                    <SelectItem value="people">People</SelectItem>
                    <SelectItem value="opportunities">Opportunities</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Field Key (camelCase)</Label>
                <Input value={cfName} onChange={(e) => setCfName(e.target.value)} required placeholder="contractTier" />
              </div>

              <div className="grid gap-2">
                <Label>Display Label</Label>
                <Input value={cfLabel} onChange={(e) => setCfLabel(e.target.value)} required placeholder="Contract Tier" />
              </div>

              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={cfType} onValueChange={(val) => setCfType(val ?? "TEXT")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="NUMBER">Number</SelectItem>
                    <SelectItem value="BOOLEAN">Boolean</SelectItem>
                    <SelectItem value="DATE">Date</SelectItem>
                    <SelectItem value="SELECT">Select</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-4 flex justify-end">
                <Button type="submit" size="sm" disabled={cfLoading}>
                  {cfLoading && <Loader2Icon className="mr-1 size-3.5 animate-spin" />}
                  Add Custom Field
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Field Key</TableHead>
                <TableHead>Display Label</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customFields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                    No custom fields configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                customFields.map((cf: any) => (
                  <TableRow key={cf.id}>
                    <TableCell className="font-medium">{cf.targetEntity}</TableCell>
                    <TableCell className="font-mono text-xs">{cf.name}</TableCell>
                    <TableCell>{cf.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{cf.fieldType}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* TAB 3: CUSTOM OBJECTS */}
      <TabsContent value="custom-objects" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DatabaseIcon className="size-4" />
              Dynamic Custom Objects
            </CardTitle>
            <CardDescription>
              User-defined business entities (e.g. Subscriptions, Hardware Deployments)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Object Name</TableHead>
                  <TableHead>Plural Name</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customObjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No custom object schemas defined yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  customObjects.map((co: any) => (
                    <TableRow key={co.id}>
                      <TableCell className="font-medium">{co.nameSingular}</TableCell>
                      <TableCell>{co.namePlural}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{co.description || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* TAB 4: TAGS */}
      <TabsContent value="tags" className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TagsIcon className="size-4" />
              Create Tag
            </CardTitle>
            <CardDescription>
              Global taxonomy labels for tagging companies, contacts, and opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTag} className="flex flex-wrap items-end gap-3">
              <div className="grid gap-2 flex-1 min-w-[200px]">
                <Label htmlFor="tag-name">Tag Name</Label>
                <Input
                  id="tag-name"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. High Priority, VIP"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tag-color">Color</Label>
                <Input
                  id="tag-color"
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer p-1"
                />
              </div>

              <Button type="submit" size="sm" disabled={tagLoading}>
                {tagLoading && <Loader2Icon className="mr-1 size-3.5 animate-spin" />}
                <PlusIcon className="mr-1 size-3.5" />
                Add Tag
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 p-4 rounded-lg border bg-card">
          {tags.length === 0 ? (
            <span className="text-xs text-muted-foreground">No tags defined yet.</span>
          ) : (
            tags.map((t: any) => (
              <Badge
                key={t.id}
                variant="outline"
                className="text-xs flex items-center gap-1.5 px-2.5 py-1"
                style={{ borderColor: t.color || "#6366f1", color: t.color || "#6366f1" }}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: t.color || "#6366f1" }} />
                {t.name}
              </Badge>
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
