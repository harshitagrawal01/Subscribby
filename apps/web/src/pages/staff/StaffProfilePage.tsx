import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function StaffProfilePage() {
  return (
    <ScreenPlaceholder
      title="My profile"
      who="Admin, Staff, Finance"
      todo={[
        "Name (editable), email and access level (read only)",
        "Change password: current, new (password rule), confirm"
      ]}
      endpoints={["GET /auth/me","PATCH /auth/me","POST /auth/change-password"]}
    />
  )
}
