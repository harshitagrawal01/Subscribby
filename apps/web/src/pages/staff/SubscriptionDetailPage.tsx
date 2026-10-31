import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function SubscriptionDetailPage() {
  return (
    <ScreenPlaceholder
      title="Subscription"
      who="Admin, Staff (Finance: read only)"
      todo={[
        "Header: number, status bar (Draft → Quotation → Confirmed → Active → Closed, Paused aside)",
        "Action buttons rendered from allowedActions (send, confirm, activate, pause, resume, renew, close, cancel, createInvoice)",
        "Fields: customer, template, plan, start, expiry, payment terms, quotation valid until, salesperson",
        "Lines table: product, variant, qty, unit price, discount, taxes, amount; edit rules depend on status",
        "Totals box (untaxed, discount, tax, total) from the API, never computed in the browser",
        "Tabs: invoices for this subscription (GET /invoices?subscriptionId=), history"
      ]}
      endpoints={["GET /subscriptions/:id","PATCH /subscriptions/:id","POST /subscriptions/:id/{action}","POST /subscriptions/:id/invoices","GET /invoices?subscriptionId="]}
    />
  )
}
