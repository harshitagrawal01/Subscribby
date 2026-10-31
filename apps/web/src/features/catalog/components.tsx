import { Alert, Button, Drawer, Group, Modal, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { ListMeta } from '@/lib/api/types'
import { tokens } from '@/theme'
import classes from './catalog.module.css'

/** Row of filters under the tabs, above the table. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Group px={20} py={12} gap="sm" wrap="wrap" className={classes.filterBar}>
      {children}
    </Group>
  )
}

/** "1–20 of 64" with Previous / Next, like the subscriptions list. */
export function Pager({ meta, onPage }: { meta: ListMeta | undefined; onPage: (page: number) => void }) {
  if (!meta || meta.total === 0) return null
  const first = (meta.page - 1) * meta.limit + 1
  const last = Math.min(meta.page * meta.limit, meta.total)
  return (
    <Group justify="space-between" px={20} py={12} className={classes.pager}>
      <Text size="sm" c="dimmed">
        <span className="num">
          {first}–{last}
        </span>{' '}
        of <span className="num">{meta.total}</span>
      </Text>
      {meta.totalPages > 1 && (
      <Group gap={6}>
        <Button size="compact-sm" variant="default" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          Previous
        </Button>
        <Button size="compact-sm" variant="default" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next
        </Button>
      </Group>
      )}
    </Group>
  )
}

/** One line and one action, for an empty list. */
export function EmptyLine({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Group p={24} gap="sm">
      <Text size="sm" c="dimmed">
        {children}
      </Text>
      {action}
    </Group>
  )
}

export function FormAlert({ message, mb = 'md' }: { message: string | null | undefined; mb?: number | string }) {
  if (!message) return null
  return (
    <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} role="alert" mb={mb}>
      {message}
    </Alert>
  )
}

interface FormDrawerProps {
  opened: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  /** The form body. Wrap it in a <form id={formId}> so the footer's submit button can target it. */
  children: ReactNode
  footer?: ReactNode
  size?: number | string
}

/** Side sheet for long forms, with a footer that stays visible while the form scrolls. */
export function FormDrawer({ opened, onClose, title, subtitle, children, footer, size = 520 }: FormDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={size}
      padding={0}
      title={
        <>
          <span className={classes.sheetTitle}>{title}</span>
          {subtitle && (
            <Text component="span" display="block" size="sm" c="dimmed" mt={2}>
              {subtitle}
            </Text>
          )}
        </>
      }
      classNames={{ header: classes.drawerHeader, content: classes.drawerContent, body: classes.drawerBody }}
    >
      <div className={classes.drawerMain}>{children}</div>
      {footer && <div className={classes.drawerFooter}>{footer}</div>}
    </Drawer>
  )
}

interface ConfirmProps {
  opened: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children: ReactNode
  confirmLabel: string
  /** Red confirm button for destructive actions. */
  danger?: boolean
  loading?: boolean
  error?: string | null
}

/** Small centred question before an action that can't be undone from here. */
export function ConfirmModal({ opened, onClose, onConfirm, title, children, confirmLabel, danger, loading, error }: ConfirmProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={<span className={classes.sheetTitle}>{title}</span>}
      size={440}
      classNames={{ content: classes.whiteSurface, header: classes.whiteSurface }}
    >
      <Stack gap="md">
        <Text size="sm">{children}</Text>
        <FormAlert message={error} mb={0} />
        <Group justify="flex-end" gap={8}>
          <Button variant="default" onClick={onClose}>
            Keep it
          </Button>
          <Button color={danger ? 'red' : undefined} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

/** Label/value rows for read-only views. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className={classes.detailList}>
      {items.map((item) => (
        <div key={item.label} className={classes.detailRow}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

/** "used / limit" with a thin bar beside it. */
export function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  const ratio = limit ? Math.min(1, used / limit) : 0
  const full = limit != null && used >= limit
  return (
    <Group gap={10} wrap="nowrap">
      <Text size="sm" className="num" miw={58}>
        {used}
        <Text span c="dimmed" size="sm">
          {' '}
          / {limit ?? 'no limit'}
        </Text>
      </Text>
      {limit != null && (
        <div className={classes.usageTrack} role="img" aria-label={`${used} of ${limit} uses`}>
          <div className={classes.usageFill} style={{ width: `${ratio * 100}%`, background: full ? tokens.status.warn : tokens.ink }} />
        </div>
      )}
    </Group>
  )
}

/** Small section heading inside a drawer form. */
export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={classes.formSection}>
      <Text fw={600} size="md">
        {title}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed" mt={2}>
          {hint}
        </Text>
      )}
      <Stack gap="sm" mt="sm">
        {children}
      </Stack>
    </section>
  )
}
