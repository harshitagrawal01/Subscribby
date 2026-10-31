import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function InvoicesPage() {
  return (
    <ScreenPlaceholder
      title="Invoices"
      who="Admin, Staff, Finance"
      todo={[
        "Status tabs from meta.statusCounts incl. Overdue (overdue=true)",
        "Filters: search, customer, invoice date range, due date range",
        "Checkbox selection + bulk Confirm / Send (Finance: Send only)",
        "\"Run billing\" button → dialog: dry run preview counts → confirm (Finance: preview only)",
        "Columns: number, customer, subscription, invoice date, due date, total, balance, status (overdue badge)"
      ]}
      endpoints={["GET /invoices","POST /invoices/bulk/confirm","POST /invoices/bulk/send","POST /billing/run","GET /billing/last-run"]}
    />
  )
}
