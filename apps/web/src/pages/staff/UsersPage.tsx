import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function UsersPage() {
  return (
    <ScreenPlaceholder
      title="Users"
      who="Admin only"
      todo={[
        "Tabs: staff accounts (admin, staff, finance) and customer logins",
        "Columns: name, email, access level, status, must change password, last login",
        "\"Add user\" modal: name, email, access level, temporary password (password rule)",
        "Row actions: change access level, disable/enable, set new temporary password",
        "Link to bulk import"
      ]}
      endpoints={["GET /users","POST /users","PATCH /users/:id","POST /users/:id/reset-password"]}
    />
  )
}
