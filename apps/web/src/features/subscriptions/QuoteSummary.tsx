import { Box, Group, Loader, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import type { BillingPeriod } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { tokens } from '@/theme'
import { PERIOD_NOUN } from './constants'
import type { PreviewResult } from './lines'
import { TotalsBlock } from './PricedLines'

interface Props {
  customerName?: string | null
  plan?: { name: string; billingPeriod: BillingPeriod } | null
  templateName?: string | null
  startDate?: string | null
  expiryDate?: string | null
  preview?: PreviewResult
  updating?: boolean
  /** Showing an earlier, valid version of the quote. */
  stale?: boolean
  problem?: string | null
  children?: ReactNode
}

/** The live quote: what the customer will pay each period, priced by the API as you type. */
export function QuoteSummary({ customerName, plan, templateName, startDate, expiryDate, preview, updating, stale, problem, children }: Props) {
  const dim = updating || stale
  const period = plan ? PERIOD_NOUN[plan.billingPeriod] : null
  return (
    <section className="panel" style={{ padding: 20 }} aria-live="polite" aria-busy={updating}>
      <Group justify="space-between" align="baseline" mb={4}>
        <Title order={2} fz={16}>
          Quotation
        </Title>
        {updating && <Loader size={12} color="gray" aria-label="Updating prices" />}
      </Group>
      <Text size="sm" c={customerName ? undefined : 'dimmed'}>
        {customerName ?? 'No customer chosen yet'}
      </Text>
      {plan && (
        <Text size="xs" c="dimmed">
          {plan.name}
          {templateName ? ` · from ${templateName}` : ''}
        </Text>
      )}
      {startDate && expiryDate && (
        <Text size="xs" c="dimmed" className="num">
          {formatDate(startDate)} to {formatDate(expiryDate)}
        </Text>
      )}

      <Box mt={18} mb={16}>
        <Text size="xs" c="dimmed">
          {period ? `Every ${period}, tax included` : 'Per period, tax included'}
        </Text>
        <Text
          className="num"
          fz={30}
          fw={600}
          lh={1.15}
          mt={2}
          style={{ letterSpacing: '-0.02em', opacity: dim ? 0.55 : 1, transition: 'opacity 120ms ease' }}
          c={preview ? undefined : tokens.faint}
        >
          {preview ? formatMoney(preview.totals.total) : '₹0.00'}
        </Text>
      </Box>

      {preview ? (
        <>
          <Stack gap={8} pb={14} mb={14} style={{ borderBottom: `1px solid ${tokens.line}`, opacity: dim ? 0.55 : 1 }}>
            {preview.lines.map((l, i) => (
              <Group key={i} justify="space-between" wrap="nowrap" align="flex-start" gap="md">
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" truncate>
                    {l.productName}
                  </Text>
                  <Text size="xs" c="dimmed" className="num">
                    {l.variantLabel ? `${l.variantLabel.replace(/^[^:]+:\s*/, '')} · ` : ''}
                    {l.quantity} × {formatMoney(l.unitPrice)}
                  </Text>
                </div>
                <Text size="sm" className="num">
                  {formatMoney(l.subtotal)}
                </Text>
              </Group>
            ))}
          </Stack>
          <TotalsBlock
            totals={preview.totals}
            lines={preview.lines}
            orderDiscount={preview.orderDiscount}
            dimmed={dim}
            totalLabel={period ? `Total per ${period}` : 'Total'}
          />
        </>
      ) : (
        <Text size="sm" c="dimmed">
          Pick a template or a plan to see prices.
        </Text>
      )}

      {problem && (
        <Text size="xs" c={tokens.status.bad} mt={12} role="alert">
          {problem}
        </Text>
      )}
      {children && <Box mt={20}>{children}</Box>}
    </section>
  )
}
