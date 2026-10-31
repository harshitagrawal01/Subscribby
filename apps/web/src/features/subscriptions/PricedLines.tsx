import { Group, Stack, Table, Text } from '@mantine/core'
import type { AppliedDiscount, PricedLine, Totals } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { tokens } from '@/theme'

/** Priced lines exactly as the API returned them: quantity × unit price, discount, tax, amount. */
export function PricedLinesTable({ lines, dimmed }: { lines: PricedLine[]; dimmed?: boolean }) {
  return (
    <Table.ScrollContainer minWidth={700}>
      <Table className="data-table" style={{ opacity: dimmed ? 0.55 : 1, transition: 'opacity 120ms ease' }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Product</Table.Th>
            <Table.Th ta="right">Quantity</Table.Th>
            <Table.Th ta="right">Unit price</Table.Th>
            <Table.Th ta="right">Discount</Table.Th>
            <Table.Th ta="right">Tax</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lines.map((l, i) => {
            const discount = (l.discount?.amount ?? 0) + l.orderDiscountShare
            return (
              <Table.Tr key={l.id ?? i}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {l.productName ?? 'Product'}
                  </Text>
                  {l.variantLabel && (
                    <Text size="xs" c="dimmed">
                      {l.variantLabel}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {l.quantity}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {formatMoney(l.unitPrice)}
                </Table.Td>
                <Table.Td ta="right">
                  {discount ? (
                    <>
                      <Text size="sm" className="num">
                        −{formatMoney(discount)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {l.discount?.name ?? 'Share of discount'}
                      </Text>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">
                  {l.taxes.length ? (
                    <>
                      <Text size="sm" className="num">
                        {formatMoney(l.taxAmount)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {l.taxes.map((t) => t.name).join(', ')}
                      </Text>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right" className="num" fw={500}>
                  {formatMoney(l.total)}
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function TotalRow({ label, note, value, tone }: { label: string; note?: string | null; value: string; tone?: string }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="lg" align="baseline">
      <Text size="sm" c="dimmed">
        {label}
        {note && (
          <Text span size="xs" c="dimmed" ml={6}>
            {note}
          </Text>
        )}
      </Text>
      <Text size="sm" className="num" c={tone}>
        {value}
      </Text>
    </Group>
  )
}

/** Untaxed, discounts, tax and the total, straight from the API's totals block. */
export function TotalsBlock({
  totals,
  lines,
  orderDiscount,
  dimmed,
  totalLabel = 'Total',
}: {
  totals: Totals
  lines: PricedLine[]
  orderDiscount?: AppliedDiscount | null
  dimmed?: boolean
  totalLabel?: string
}) {
  const discountNames = [...new Set([...lines.map((l) => l.discount?.name), orderDiscount?.name].filter(Boolean))].join(', ')
  const taxNames = [...new Set(lines.flatMap((l) => l.taxes.map((t) => t.name)))].join(', ')
  return (
    <Stack gap={6} style={{ opacity: dimmed ? 0.55 : 1, transition: 'opacity 120ms ease' }}>
      <TotalRow label="Untaxed amount" value={formatMoney(totals.untaxedAmount)} />
      {totals.discountTotal > 0 && (
        <TotalRow label="Discount" note={discountNames} value={`−${formatMoney(totals.discountTotal)}`} />
      )}
      <TotalRow label="Tax" note={taxNames || null} value={formatMoney(totals.taxTotal)} />
      <Group justify="space-between" wrap="nowrap" align="baseline" pt={8} mt={2} style={{ borderTop: `1px solid ${tokens.line}` }}>
        <Text fw={500}>{totalLabel}</Text>
        <Text className="num" fw={600} fz={18}>
          {formatMoney(totals.total)}
        </Text>
      </Group>
    </Stack>
  )
}
