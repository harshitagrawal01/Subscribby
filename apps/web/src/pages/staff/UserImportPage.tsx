import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function UserImportPage() {
  return (
    <ScreenPlaceholder
      title="Import users from CSV"
      who="Admin only"
      todo={[
        "Download template button (GET /users/import/template)",
        "File picker (.csv, ≤ 1 MB, ≤ 200 rows): name, email, temporary_password, access_level",
        "Preview with dryRun=true: table of rows with valid/invalid status and per-field errors",
        "\"Create N users\" (dryRun=false), disabled while any row is invalid (all or nothing)"
      ]}
      endpoints={["GET /users/import/template","POST /users/import?dryRun=true","POST /users/import?dryRun=false"]}
    />
  )
}
