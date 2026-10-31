import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function TaxesPage() {
  return (
    <ScreenPlaceholder
      title="Taxes"
      who="Admin only"
      todo={[
        "Columns: name, type, rate, applies to, active",
        "Create/edit modal: name, percentage or fixed, rate, applies to (all / product types / products)"
      ]}
      endpoints={["GET /taxes","POST /taxes","PATCH /taxes/:id","DELETE /taxes/:id"]}
    />
  )
}
