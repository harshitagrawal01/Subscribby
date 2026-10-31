import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'

export function ProductsPage() {
  return (
    <ScreenPlaceholder
      title="Products"
      who="Admin (edit), Staff and Finance (read)"
      todo={[
        "Search, type filter; columns: name, type, sales price, cost price, variants, used in plans",
        "Create/edit form: name, type, sales price, cost price, notes",
        "Variants editor: attribute, value, extra price (e.g. Brand: Odoo +₹560)",
        "Archive"
      ]}
      endpoints={["GET /products","POST /products","PATCH /products/:id","DELETE /products/:id"]}
    />
  )
}
