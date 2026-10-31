import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function PaymentsPage() {
  return (
    <ScreenPlaceholder
      title="Payments"
      who="Admin, Staff, Finance"
      todo={[
        "Filters: search, method, date range; total of filtered payments (meta.totalAmount)",
        "\"Record payment\" modal: pick a confirmed invoice with balance, method, amount, date, note",
        "Admin only: reverse a payment (DELETE with reason)"
      ]}
      endpoints={["GET /payments","POST /payments","DELETE /payments/:id","GET /invoices?status=confirmed"]}
    />
  )
}
