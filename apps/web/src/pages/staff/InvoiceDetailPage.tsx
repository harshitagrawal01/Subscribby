import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function InvoiceDetailPage() {
  return (
    <ScreenPlaceholder
      title="Invoice"
      who="Admin, Staff, Finance"
      todo={[
        "Status bar Draft → Confirmed → Paid; overdue badge with days late",
        "Buttons from allowedActions: confirm, cancel (rebill), send, record payment, print",
        "Customer snapshot + company block, billing period, invoice and due dates",
        "Lines with discounts and taxes; totals; amount paid; balance due",
        "Payments on this invoice; \"Record payment\" modal (method, amount ≤ balance, date, note)",
        "Print view (window print styles) built from this response"
      ]}
      endpoints={["GET /invoices/:id","PATCH /invoices/:id","POST /invoices/:id/confirm","POST /invoices/:id/cancel","POST /invoices/:id/send","POST /payments"]}
    />
  )
}
