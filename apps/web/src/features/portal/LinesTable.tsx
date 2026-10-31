import { Text } from '@mantine/core'
import type { ReactNode } from 'react'
import type { AppliedDiscount, PricedLine, Totals } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import classes from './LinesTable.module.css'

/** Discounts and taxes added up by name, for the totals block. */
function breakdown(lines: PricedLine[], orderDiscount: AppliedDiscount | null) {
  const discounts = new Map<string, number>()
  const taxes = new Map<string, number>()
  for (const line of lines) {
    if (line.discount?.amount) discounts.set(line.discount.name, (discounts.get(line.discount.name) ?? 0) + line.discount.amount)
    for (const tax of line.taxes) taxes.set(tax.name, (taxes.get(tax.name) ?? 0) + tax.amount)
  }
  if (orderDiscount?.amount) discounts.set(orderDiscount.name, (discounts.get(orderDiscount.name) ?? 0) + orderDiscount.amount)
  return { discounts: [...discounts], taxes: [...taxes] }
}

interface Props {
  lines: PricedLine[]
  totals: Totals
  orderDiscount: AppliedDiscount | null
  /** Label for the grand total ("Total per month", "Total"). */
  totalLabel: string
  /** Extra rows under the total (payments, balance due on an invoice). */
  after?: ReactNode
}

/** Priced lines and totals, shared by the subscription and the invoice. Money in tabular figures. */
export function LinesTable({ lines, totals, orderDiscount, totalLabel, after }: Props) {
  const { discounts, taxes } = breakdown(lines, orderDiscount)
  return (
    <div>
      <div className={classes.scroll}>
        <table className={classes.lines}>
          <thead>
            <tr>
              <th>Item</th>
              <th className={classes.right}>Qty</th>
              <th className={classes.right}>Unit price</th>
              <th className={classes.right}>Discount</th>
              <th className={classes.right}>Tax</th>
              <th className={classes.right}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const discount = (line.discount?.amount ?? 0) + line.orderDiscountShare
              return (
                <tr key={line.id ?? i}>
                  <td>
                    <Text size="sm" fw={500}>
                      {line.productName ?? line.description ?? 'Item'}
                    </Text>
                    {line.variantLabel && (
                      <Text size="xs" c="dimmed">
                        {line.variantLabel}
                      </Text>
                    )}
                    {line.discount && (
                      <Text size="xs" c="dimmed">
                        {line.discount.name}
                      </Text>
                    )}
                  </td>
                  <td className={`${classes.right} num`}>{line.quantity}</td>
                  <td className={`${classes.right} num`}>{formatMoney(line.unitPrice)}</td>
                  <td className={`${classes.right} num`}>{discount ? `−${formatMoney(discount)}` : '—'}</td>
                  <td className={`${classes.right} num`} title={line.taxes.map((t) => t.name).join(', ')}>
                    {line.taxAmount ? formatMoney(line.taxAmount) : '—'}
                  </td>
                  <td className={`${classes.right} num`}>{formatMoney(line.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <dl className={classes.totals}>
        <div>
          <dt>Subtotal</dt>
          <dd className="num">{formatMoney(totals.untaxedAmount)}</dd>
        </div>
        {discounts.map(([name, amount]) => (
          <div key={`d-${name}`}>
            <dt>{name}</dt>
            <dd className="num">−{formatMoney(amount)}</dd>
          </div>
        ))}
        {taxes.map(([name, amount]) => (
          <div key={`t-${name}`}>
            <dt>{name}</dt>
            <dd className="num">{formatMoney(amount)}</dd>
          </div>
        ))}
        <div className={classes.grand}>
          <dt>{totalLabel}</dt>
          <dd className="num">{formatMoney(totals.total)}</dd>
        </div>
        {after}
      </dl>
    </div>
  )
}
