import { Anchor, Text } from '@mantine/core'
import { Link } from 'react-router'
import { staffPath } from '@/features/auth/staff-base'
import type { Address, Invoice } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { INVOICE_STATUS } from '@/lib/labels'
import { tokens } from '@/theme'
import classes from './InvoiceDocument.module.css'

const addressLines = (a?: Address) =>
  a
    ? [
        a.line1,
        a.line2,
        [a.city, a.state, a.postalCode].filter(Boolean).join(', '),
        a.country === 'IN' ? 'India' : a.country,
      ].filter((l): l is string => Boolean(l && l.trim()))
    : []

/** Sum each named tax across lines, for the totals block. */
function taxBreakdown(invoice: Invoice) {
  const byName = new Map<string, number>()
  for (const line of invoice.lines) for (const t of line.taxes) byName.set(t.name, (byName.get(t.name) ?? 0) + t.amount)
  return [...byName.entries()]
}

function TotalRow({ label, value, className }: { label: React.ReactNode; value: string; className?: string }) {
  return (
    <div className={`${classes.totalRow} ${className ?? ''}`}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}

/** The invoice laid out as the customer would receive it. Also what gets printed. */
export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const { company, customerSnapshot: to } = invoice
  const status = INVOICE_STATUS[invoice.isOverdue ? 'overdue' : invoice.status]
  const lineDiscounts = invoice.lines.reduce((s, l) => s + (l.discount?.amount ?? 0), 0)
  const cancelled = invoice.status === 'cancelled'
  const companyEmail = (company as Invoice['company'] & { email?: string }).email

  return (
    <article className={classes.sheet} aria-label={`Invoice ${invoice.number}`}>
      <header className={classes.top}>
        <div>
          <p className={classes.company}>{company.name}</p>
          <Text size="sm" c="dimmed" maw={300} style={{ whiteSpace: 'pre-line' }}>
            {company.address}
          </Text>
          {company.taxId && (
            <Text size="sm" c="dimmed" mt={4}>
              GSTIN <span className="mono">{company.taxId}</span>
            </Text>
          )}
        </div>
        <div>
          <h2 className={classes.docTitle}>{invoice.status === 'draft' ? 'Draft invoice' : 'Tax invoice'}</h2>
          <Text ta="right" className="mono" fz={15} fw={500}>
            {invoice.number}
          </Text>
          <Text ta="right" size="sm" c={status.color} fw={500} mt={4}>
            {status.label}
            {invoice.isOverdue && ` · ${invoice.daysOverdue} ${invoice.daysOverdue === 1 ? 'day' : 'days'} late`}
          </Text>
        </div>
      </header>

      <section className={classes.meta}>
        <div>
          <div className={classes.label}>Bill to</div>
          <Text fw={600}>{to.name}</Text>
          {addressLines(to.billingAddress).map((line) => (
            <Text key={line} size="sm">
              {line}
            </Text>
          ))}
          {to.email && (
            <Text size="sm" c="dimmed">
              {to.email}
            </Text>
          )}
          {to.taxId && (
            <Text size="sm" c="dimmed" mt={4}>
              GSTIN <span className="mono">{to.taxId}</span>
            </Text>
          )}
        </div>
        <dl className={classes.facts}>
          <dt>Invoice date</dt>
          <dd>{formatDate(invoice.invoiceDate)}</dd>
          <dt>Due date</dt>
          <dd style={{ color: invoice.isOverdue ? tokens.status.bad : undefined, fontWeight: 500 }}>
            {formatDate(invoice.dueDate)}
          </dd>
          <dt>Billing period</dt>
          <dd>
            {formatDate(invoice.periodStart)} to {formatDate(invoice.periodEnd)}
          </dd>
          <dt>Subscription</dt>
          <dd>
            <Anchor component={Link} to={staffPath(`/subscriptions/${invoice.subscription.id}`)} className="mono" size="sm">
              {invoice.subscription.number}
            </Anchor>
          </dd>
        </dl>
      </section>

      <table className={classes.lines}>
        <thead>
          <tr>
            <th>Description</th>
            <th className={classes.right}>Qty</th>
            <th className={classes.right}>Unit price</th>
            <th className={classes.right}>Discount</th>
            <th className={classes.right}>Tax</th>
            <th className={classes.right}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, i) => {
            const discount = (line.discount?.amount ?? 0) + (line.orderDiscountShare ?? 0)
            return (
              <tr key={line.id ?? i}>
                <td>
                  <Text size="sm" fw={500}>
                    {line.description ?? [line.productName, line.variantLabel].filter(Boolean).join(' · ')}
                  </Text>
                  {line.discount && (
                    <Text size="xs" c="dimmed">
                      {line.discount.name}
                    </Text>
                  )}
                </td>
                <td className={`${classes.right} num`}>{line.quantity}</td>
                <td className={`${classes.right} num`}>{formatMoney(line.unitPrice)}</td>
                <td className={`${classes.right} num`}>{discount ? `−${formatMoney(discount)}` : '—'}</td>
                <td className={classes.right}>
                  <span className="num">{line.taxAmount ? formatMoney(line.taxAmount) : '—'}</span>
                  {line.taxes.length > 0 && (
                    <Text size="xs" c="dimmed">
                      {line.taxes.map((t) => t.name).join(', ')}
                    </Text>
                  )}
                </td>
                <td className={`${classes.right} num`} style={{ fontWeight: 500 }}>
                  {formatMoney(line.total)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className={classes.totalsWrap}>
        {invoice.status === 'paid' && (
          <div className={classes.stamp} style={{ color: tokens.status.good }} aria-hidden>
            PAID
          </div>
        )}
        {cancelled && (
          <div className={classes.stamp} style={{ color: tokens.status.bad }} aria-hidden>
            VOID
          </div>
        )}
        <div className={classes.totals}>
          <TotalRow label="Subtotal" value={formatMoney(invoice.untaxedAmount)} />
          {lineDiscounts > 0 && <TotalRow label="Line discounts" value={`−${formatMoney(lineDiscounts)}`} />}
          {invoice.orderDiscount && (
            <TotalRow
              label={`Subscription discount (${invoice.orderDiscount.name})`}
              value={`−${formatMoney(invoice.orderDiscount.amount)}`}
            />
          )}
          {invoice.discountTotal > 0 && (
            <TotalRow label="Taxable amount" value={formatMoney(invoice.untaxedAmount - invoice.discountTotal)} />
          )}
          {taxBreakdown(invoice).map(([name, amount]) => (
            <TotalRow key={name} label={name} value={formatMoney(amount)} />
          ))}
          <TotalRow label="Total" value={formatMoney(invoice.total)} className={classes.grand} />
          {invoice.amountPaid > 0 && <TotalRow label="Paid" value={`−${formatMoney(invoice.amountPaid)}`} />}
          {!cancelled && (
            <div className={classes.balance}>
              <span style={{ fontWeight: 500 }}>Balance due</span>
              <span
                className={`num ${classes.balanceAmount}`}
                style={{ color: invoice.isOverdue ? tokens.status.bad : undefined }}
              >
                {formatMoney(invoice.balance)}
              </span>
            </div>
          )}
        </div>
      </div>

      {invoice.notes && (
        <div style={{ marginTop: 28 }}>
          <div className={classes.label}>Notes</div>
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
            {invoice.notes}
          </Text>
        </div>
      )}

      <footer className={classes.footer}>
        <span>
          {cancelled
            ? 'This invoice was cancelled and is not payable.'
            : invoice.balance > 0
              ? `Please pay by ${formatDate(invoice.dueDate)}, quoting ${invoice.number}.`
              : 'Paid in full. Thank you.'}
        </span>
        {companyEmail && <span>Questions? {companyEmail}</span>}
      </footer>
    </article>
  )
}
