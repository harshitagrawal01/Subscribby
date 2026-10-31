import { Anchor, Text, Title } from '@mantine/core'
import { Link } from 'react-router'
import { Logo } from '@/components/Logo'
import { InvoiceStatusBadge } from '@/components/StatusBadge'
import type { Invoice } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/labels'
import { addressLines, overdueText } from './format'
import classes from './InvoicePaper.module.css'
import { LinesTable } from './LinesTable'
import type { CompanyDetails } from './types'

/** The invoice as a document: who it's from, who it's for, lines, totals, payments, balance. */
export function InvoicePaper({ invoice }: { invoice: Invoice }) {
  const company = invoice.company as CompanyDetails
  const bill = invoice.customerSnapshot
  const owing = invoice.status === 'confirmed' && invoice.balance > 0
  const totals = { untaxedAmount: invoice.untaxedAmount, discountTotal: invoice.discountTotal, taxTotal: invoice.taxTotal, total: invoice.total }

  return (
    <article className={classes.paper} aria-label={`Invoice ${invoice.number}`}>
      <header className={classes.head}>
        <div className={classes.company}>
          <Logo size="sm" />
          <Text fw={600} mt={14}>
            {company.name}
          </Text>
          <Text size="sm" c="dimmed" mt={2}>
            {company.address}
          </Text>
          <Text size="sm" c="dimmed">
            GSTIN <span className="mono">{company.taxId}</span>
          </Text>
          {company.email && (
            <Text size="sm" c="dimmed">
              {company.email}
            </Text>
          )}
        </div>
        <div className={classes.docTitle}>
          <Title order={1} fz={30} lh={1}>
            {invoice.status === 'paid' ? 'Paid invoice' : 'Invoice'}
          </Title>
          <Text className="mono" mt={10} size="lg">
            {invoice.number}
          </Text>
          <div style={{ marginTop: 8 }}>
            <InvoiceStatusBadge status={invoice.status} overdue={invoice.isOverdue} />
          </div>
        </div>
      </header>

      <section className={classes.parties}>
        <div>
          <div className={classes.label}>Bill to</div>
          <Text fw={600}>{bill.name}</Text>
          {addressLines(bill.billingAddress).map((line) => (
            <Text key={line} size="sm">
              {line}
            </Text>
          ))}
          {bill.taxId && (
            <Text size="sm" c="dimmed" mt={4}>
              GSTIN <span className="mono">{bill.taxId}</span>
            </Text>
          )}
          {bill.email && (
            <Text size="sm" c="dimmed">
              {bill.email}
            </Text>
          )}
        </div>
        <dl className={classes.meta}>
          <dt>Invoice date</dt>
          <dd>{formatDate(invoice.invoiceDate)}</dd>
          <dt>Due date</dt>
          <dd>
            {formatDate(invoice.dueDate)}
            {invoice.isOverdue && (
              <Text span size="xs" c="#B42318" fw={500} ml={6}>
                {overdueText(invoice.daysOverdue)}
              </Text>
            )}
          </dd>
          <dt>Service period</dt>
          <dd>
            {formatDate(invoice.periodStart)} to {formatDate(invoice.periodEnd)}
          </dd>
          <dt>Subscription</dt>
          <dd>
            <Anchor component={Link} to={`/portal/subscriptions/${invoice.subscription.id}`} className="mono" size="sm">
              {invoice.subscription.number}
            </Anchor>
          </dd>
        </dl>
      </section>

      <LinesTable
        lines={invoice.lines}
        totals={totals}
        orderDiscount={invoice.orderDiscount}
        totalLabel="Total"
        after={
          invoice.status !== 'cancelled' && (
            <>
              {invoice.amountPaid > 0 && (
                <div>
                  <dt>Paid</dt>
                  <dd className="num">−{formatMoney(invoice.amountPaid)}</dd>
                </div>
              )}
              <div className={`${classes.balanceRow} ${owing ? (invoice.isOverdue ? classes.balanceOverdue : classes.balanceDue) : ''}`}>
                <dt>{owing ? 'Balance due' : 'Balance'}</dt>
                <dd className="num">{formatMoney(invoice.balance)}</dd>
              </div>
              {owing && (
                <Text size="xs" c="dimmed" ta="right" mt={4}>
                  {invoice.isOverdue ? `Was due on ${formatDate(invoice.dueDate)}. Please pay as soon as you can.` : `Please pay by ${formatDate(invoice.dueDate)}`}
                </Text>
              )}
            </>
          )
        }
      />

      {invoice.payments.length > 0 && (
        <section className={classes.payments}>
          <Title order={2} fz={15} mb={10}>
            Payments received
          </Title>
          <dl className={classes.meta} style={{ gridTemplateColumns: 'auto 1fr auto' }}>
            {invoice.payments.map((p) => (
              <PaymentRow key={p.id} date={p.paymentDate} method={PAYMENT_METHOD_LABELS[p.method]} note={p.note} amount={p.amount} />
            ))}
          </dl>
        </section>
      )}

      <footer className={classes.foot}>
        {invoice.status === 'cancelled'
          ? 'This invoice was cancelled and nothing is owed on it.'
          : `Questions about this invoice? Write to ${company.email ?? company.name} and quote ${invoice.number}.`}
      </footer>
    </article>
  )
}

function PaymentRow({ date, method, note, amount }: { date: string; method: string; note: string; amount: number }) {
  return (
    <>
      <dt>{formatDate(date)}</dt>
      <dd style={{ textAlign: 'left' }}>
        {method}
        {note && (
          <Text span c="dimmed" size="sm">
            {' '}
            · {note}
          </Text>
        )}
      </dd>
      <dd className="num">{formatMoney(amount)}</dd>
    </>
  )
}
