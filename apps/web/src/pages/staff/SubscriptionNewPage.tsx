import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function SubscriptionNewPage() {
  return (
    <ScreenPlaceholder
      title="New subscription"
      who="Admin, Staff"
      todo={[
        "Pick customer, then a quotation template (fills plan + lines) or a plan",
        "Start date, expiry date (default +1 year), payment terms, salesperson, notes",
        "Lines editor with live totals from POST /subscriptions/preview (debounced)",
        "Show plan minimum quantity and availability errors (BELOW_MIN_QUANTITY, PLAN_NOT_AVAILABLE)",
        "Save as Draft, then go to the detail page"
      ]}
      endpoints={["GET /customers","GET /quotation-templates","GET /plans","GET /products","POST /subscriptions/preview","POST /subscriptions"]}
    />
  )
}
