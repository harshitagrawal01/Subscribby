import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function PortalSubscriptionsPage() {
  return (
    <ScreenPlaceholder
      title="My subscriptions"
      who="Customer"
      todo={[
        "Banner for quotations waiting for acceptance (from /portal/summary) with Review button",
        "Cards: number, plan, status, next invoice date, amount per period",
        "Summary: outstanding amount, overdue count"
      ]}
      endpoints={["GET /portal/summary","GET /portal/subscriptions"]}
    />
  )
}
