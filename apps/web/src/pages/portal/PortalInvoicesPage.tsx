import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function PortalInvoicesPage() {
  return (
    <ScreenPlaceholder
      title="My invoices"
      who="Customer"
      todo={[
        "Tabs: all, unpaid, paid; overdue badge",
        "Columns: number, date, due, amount, balance, status; View"
      ]}
      endpoints={["GET /portal/invoices"]}
    />
  )
}
