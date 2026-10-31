import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function DiscountsPage() {
  return (
    <ScreenPlaceholder
      title="Discounts"
      who="Admin only"
      todo={[
        "Tabs by state: running, scheduled, expired, exhausted, inactive",
        "Columns: name, type, value, min purchase, min qty, dates, used / limit, applies to",
        "Create/edit: type (fixed or %), value, min purchase, min qty, start/end, usage limit, applies to (products or whole subscription)",
        "\"Stop now\" button"
      ]}
      endpoints={["GET /discounts","POST /discounts","PATCH /discounts/:id","POST /discounts/:id/stop","GET /products"]}
    />
  )
}
