import { getSettingsData } from "@/actions/crm"
import { SettingsClient } from "@/components/settings/settings-client"

export default async function SettingsPage() {
  const data = await getSettingsData()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground">
          Field-level permissions, dynamic custom fields, custom object schemas, and tag catalog.
        </p>
      </div>

      <SettingsClient initialData={data} />
    </div>
  )
}
