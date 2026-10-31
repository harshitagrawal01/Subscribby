import { Alert, Button, Group, Modal, Skeleton, Stack, Text } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState } from 'react'
import { isApiError } from '@/lib/api/client'
import { billingApi } from '@/lib/api/endpoints'
import type { BillingRunResult } from '@/lib/api/types'
import { formatDate, pluralize, today } from '@/lib/format'
import { notifyDone, notifyError } from '@/lib/notify'
import { tokens } from '@/theme'
import { invalidateBilling } from './invalidate'

function Figure({ label, value, note, tone }: { label: string; value: number; note?: string; tone?: string }) {
  return (
    <Group justify="space-between" align="baseline" py={9} wrap="nowrap" style={{ borderBottom: `1px solid ${tokens.line}` }}>
      <div>
        <Text size="sm">{label}</Text>
        {note && (
          <Text size="xs" c="dimmed">
            {note}
          </Text>
        )}
      </div>
      <Text className="num" fw={500} c={tone}>
        {value}
      </Text>
    </Group>
  )
}

function RunFigures({ result, past }: { result: BillingRunResult; past: boolean }) {
  const l = result.lifecycle
  return (
    <div>
      <Figure
        label="Subscriptions due"
        value={result.dueSubscriptions}
        note="Active, with a billing date on or before this day"
      />
      <Figure
        label={past ? 'Draft invoices created' : 'Draft invoices to create'}
        value={result.created}
        note="Includes catch-up periods that were missed"
        tone={result.created ? tokens.ink : undefined}
      />
      <Figure label="Already invoiced, skipped" value={result.skippedAlreadyInvoiced} />
      <Figure
        label={past ? 'Status changes applied' : 'Status changes first'}
        value={l.quotationsExpired + l.activated + l.autoClosed}
        note={`${l.activated} activated, ${l.quotationsExpired} quotations expired, ${l.autoClosed} closed at expiry`}
      />
      {result.failed.length > 0 && <Figure label="Failed" value={result.failed.length} tone={tokens.status.bad} />}
    </div>
  )
}

function Failures({ result }: { result: BillingRunResult }) {
  if (!result.failed.length) return null
  return (
    <Alert
      color="red"
      variant="light"
      icon={<IconAlertCircle size={16} />}
      title={`${pluralize(result.failed.length, 'subscription')} could not be billed`}
    >
      <Stack gap={4}>
        {result.failed.map((f) => (
          <Text key={f.subscriptionId} size="sm">
            <span className="mono">{f.number}</span>: {f.message}
          </Text>
        ))}
      </Stack>
    </Alert>
  )
}

/**
 * Run billing: pick a day, see a dry run, then create the drafts.
 * Finance can only preview (the API refuses a real run for that role).
 */
export function BillingRunModal({ opened, onClose, canRun }: { opened: boolean; onClose: () => void; canRun: boolean }) {
  const queryClient = useQueryClient()
  const [asOfDate, setAsOfDate] = useState(today())
  const [result, setResult] = useState<BillingRunResult | null>(null)

  const preview = useQuery({
    queryKey: ['billing', 'preview', asOfDate],
    queryFn: () => billingApi.run({ asOfDate, dryRun: true }),
    enabled: opened && !result,
    staleTime: 0,
    gcTime: 0,
  })

  const run = useMutation({
    mutationFn: () => billingApi.run({ asOfDate, dryRun: false }),
    onSuccess: (data) => {
      setResult(data)
      invalidateBilling(queryClient)
      notifyDone(`Billing run for ${formatDate(data.asOfDate)} created ${pluralize(data.created, 'draft invoice')}.`)
    },
    onError: (error) => notifyError(error, 'Billing did not run. Try again.'),
  })

  const close = () => {
    onClose()
    // Let the modal fade out before resetting what it shows.
    setTimeout(() => {
      setResult(null)
      setAsOfDate(today())
      run.reset()
    }, 200)
  }

  const p = preview.data
  const lifecycleChanges = p ? p.lifecycle.activated + p.lifecycle.quotationsExpired + p.lifecycle.autoClosed : 0
  const nothingToDo = p && !p.created && !lifecycleChanges
  const dayLabel = dayjs(asOfDate).format('D MMM')

  return (
    <Modal
      opened={opened}
      onClose={close}
      size="md"
      title={
        <Text component="span" fw={600} ff="heading" fz={18}>
          {result ? `Billing run for ${dayLabel} finished` : canRun ? 'Run billing' : 'Preview billing'}
        </Text>
      }
    >
      {result ? (
        <Stack gap="md">
          <Text size="sm">
            {result.created
              ? `${pluralize(result.created, 'draft invoice')} created. Review and confirm them before sending.`
              : 'No invoices were created. Every due period was already billed.'}
          </Text>
          <RunFigures result={result} past />
          <Failures result={result} />
          <Group justify="flex-end">
            <Button onClick={close}>Done</Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="md">
          <DateInput
            label="Bill everything due on or before"
            valueFormat="DD MMM YYYY"
            value={asOfDate}
            onChange={(v) => v && setAsOfDate(dayjs(v).format('YYYY-MM-DD'))}
            allowDeselect={false}
            w={220}
          />
          <div>
            <Text size="xs" c="dimmed" mb={2}>
              Dry run: nothing is saved yet
            </Text>
            {preview.isLoading && (
              <Stack gap={14} py={10}>
                {[0, 1, 2, 3].map((i) => (
                  <Group key={i} justify="space-between">
                    <Skeleton h={10} w="45%" />
                    <Skeleton h={10} w={24} />
                  </Group>
                ))}
              </Stack>
            )}
            {preview.error && (
              <Group gap="sm" py={8}>
                <Text size="sm" c={tokens.status.bad}>
                  Couldn't preview billing. {isApiError(preview.error) ? preview.error.message : ''}
                </Text>
                <Button size="compact-sm" variant="default" onClick={() => preview.refetch()}>
                  Try again
                </Button>
              </Group>
            )}
            {p && <RunFigures result={p} past={false} />}
          </div>
          {p && <Failures result={p} />}
          {nothingToDo && (
            <Text size="sm" c="dimmed">
              Nothing to bill on {dayLabel}. Every active subscription is invoiced up to date.
            </Text>
          )}
          {p && !canRun && (
            <Text size="sm" c="dimmed">
              Finance can preview billing. Ask an admin or staff member to run it.
            </Text>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={close}>
              {canRun && !nothingToDo ? 'Cancel' : 'Close'}
            </Button>
            {canRun && p && !nothingToDo && (
              <Button loading={run.isPending} onClick={() => run.mutate()}>
                {p.created
                  ? `Create ${pluralize(p.created, 'invoice')}`
                  : `Apply ${pluralize(lifecycleChanges, 'status change')}`}
              </Button>
            )}
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
