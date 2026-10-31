import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function PortalProfilePage() {
  return (
    <ScreenPlaceholder
      title="My profile"
      who="Customer"
      todo={[
        "Name, phone, company details",
        "Change password"
      ]}
      endpoints={["GET /auth/me","PATCH /auth/me","POST /auth/change-password"]}
    />
  )
}
