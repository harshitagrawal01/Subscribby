import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function PortalInvoiceDetailPage() {
  return (
    <ScreenPlaceholder
      title="Invoice"
      who="Customer"
      todo={[
        "Read-only invoice with lines, taxes, totals, payments and balance",
        "Print / download (browser print view)"
      ]}
      endpoints={["GET /portal/invoices/:id"]}
    />
  )
}
