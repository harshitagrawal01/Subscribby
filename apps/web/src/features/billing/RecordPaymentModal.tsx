import { Modal, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { invoicesApi } from '@/lib/api/endpoints'
import type { InvoiceListItem } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { PaymentForm, type PayableInvoice } from './PaymentForm'

interface Props {
  opened: boolean
  onClose: () => void
  /** Known invoice (invoice page). Leave out to let the person pick one (payments page). */
  invoice?: PayableInvoice
}

const optionLabel = (inv: InvoiceListItem) => `${inv.number} · ${inv.customer.name} · balance ${formatMoney(inv.balance)}`

/** Picks a confirmed invoice with a balance, searching on the server. */
function InvoicePicker({ value, onChange }: { value: InvoiceListItem | null; onChange: (inv: InvoiceListItem | null) => void }) {
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 250)
  // Typing into the box after picking shows the picked label; only search on what the person typed.
  const term = value && debounced === optionLabel(value) ? '' : debounced
  const list = useQuery({
    queryKey: ['invoices', 'payable', term],
    queryFn: () => invoicesApi.list({ status: 'confirmed', search: term || undefined, limit: 30, sort: 'dueDate' }),
    placeholderData: keepPreviousData,
  })
  const payable = (list.data?.data ?? []).filter((inv) => inv.balance > 0)
  if (value && !payable.some((inv) => inv.id === value.id)) payable.unshift(value)

  return (
    <Select
      label="Invoice"
      description="Unpaid confirmed invoices, earliest due first"
      placeholder="Search by invoice number or customer"
      searchable
      data-autofocus
      nothingFoundMessage={list.isFetching ? 'Searching…' : 'No unpaid invoice matches'}
      filter={({ options }) => options}
      data={payable.map((inv) => ({ value: inv.id, label: optionLabel(inv) }))}
      value={value?.id ?? null}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(id) => onChange(payable.find((inv) => inv.id === id) ?? null)}
      comboboxProps={{ withinPortal: true }}
      maxDropdownHeight={280}
    />
  )
}

export function RecordPaymentModal({ opened, onClose, invoice }: Props) {
  const [picked, setPicked] = useState<InvoiceListItem | null>(null)
  const target: PayableInvoice | null =
    invoice ??
    (picked ? { id: picked.id, number: picked.number, balance: picked.balance, customerName: picked.customer.name } : null)

  const close = () => {
    setPicked(null)
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={close}
      size="lg"
      title={
        <Text component="span" fw={600} ff="heading" fz={18}>
          {invoice ? `Record payment on ${invoice.number}` : 'Record payment'}
        </Text>
      }
    >
      <Stack gap="md">
        {!invoice && <InvoicePicker value={picked} onChange={setPicked} />}
        {target ? (
          <PaymentForm key={target.id} invoice={target} onDone={close} onCancel={close} />
        ) : (
          <Text size="sm" c="dimmed">
            Pick the invoice this payment is for. Only confirmed invoices with money still due can take a payment.
          </Text>
        )}
      </Stack>
    </Modal>
  )
}
