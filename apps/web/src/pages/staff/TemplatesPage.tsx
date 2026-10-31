import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function TemplatesPage() {
  return (
    <ScreenPlaceholder
      title="Quotation templates"
      who="Admin, Staff (Finance: read only)"
      todo={[
        "Columns: name, plan, valid for (days), lines, times used",
        "Create/edit: name, plan, validity days, payment terms, lines (product, variant, qty), terms/notes"
      ]}
      endpoints={["GET /quotation-templates","POST /quotation-templates","PATCH /quotation-templates/:id","DELETE /quotation-templates/:id"]}
    />
  )
}
