import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function CustomerDetailPage() {
  return (
    <ScreenPlaceholder
      title="Customer"
      who="Admin, Staff (Finance: read only)"
      todo={[
        "Editable details: name, contact, email, phone, billing address, GSTIN, notes",
        "Stats: active subscriptions, outstanding, overdue, paid to date",
        "Tabs: subscriptions, invoices, payments for this customer",
        "Archive (blocked if active subscriptions)"
      ]}
      endpoints={["GET /customers/:id","PATCH /customers/:id","DELETE /customers/:id","GET /subscriptions?customerId=","GET /invoices?customerId=","GET /payments?customerId="]}
    />
  )
}
