import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function CustomersPage() {
  return (
    <ScreenPlaceholder
      title="Customers"
      who="Admin, Staff (Finance: read only)"
      todo={[
        "Search; filters: has overdue, has active subscription",
        "Columns: name, email, active subs, outstanding, portal status",
        "\"New customer\" form (Admin, Staff)"
      ]}
      endpoints={["GET /customers","POST /customers"]}
    />
  )
}
