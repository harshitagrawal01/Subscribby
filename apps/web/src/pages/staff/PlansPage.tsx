import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function PlansPage() {
  return (
    <ScreenPlaceholder
      title="Plans"
      who="Admin (edit), Staff and Finance (read)"
      todo={[
        "Columns: name, product, price, billing period, min qty, available dates, rules, active subs",
        "Create/edit form: name, product, price, period (daily/weekly/monthly/yearly), min quantity, available from/until",
        "Rule checkboxes: auto-close, closable early, pausable, renewable"
      ]}
      endpoints={["GET /plans","POST /plans","PATCH /plans/:id","DELETE /plans/:id","GET /products"]}
    />
  )
}
