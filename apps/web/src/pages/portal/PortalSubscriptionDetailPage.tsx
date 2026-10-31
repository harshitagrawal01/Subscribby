import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function PortalSubscriptionDetailPage() {
  return (
    <ScreenPlaceholder
      title="Subscription"
      who="Customer"
      todo={[
        "Status bar, plan, dates, lines and totals (read only)",
        "Accept / Reject for a quotation; Pause / Resume / Renew / Close only if in allowedActions",
        "Invoices for this subscription"
      ]}
      endpoints={["GET /portal/subscriptions/:id","POST /portal/subscriptions/:id/{accept|reject|pause|resume|renew|close}","GET /portal/invoices"]}
    />
  )
}
