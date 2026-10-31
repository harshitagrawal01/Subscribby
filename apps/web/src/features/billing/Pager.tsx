import { Button, Group, Text } from '@mantine/core'
import type { ListMeta } from '@/lib/api/types'

/** "21–40 of 174" with Previous / Next, matching the subscriptions list. */
export function Pager({ meta, onPage, extra }: { meta: ListMeta; onPage: (page: number) => void; extra?: React.ReactNode }) {
  if (!meta.total) return null
  const firstRow = (meta.page - 1) * meta.limit + 1
  const lastRow = Math.min(meta.page * meta.limit, meta.total)
  return (
    <Group justify="space-between" px={20} py={12} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      <Group gap="lg">
        <Text size="sm" c="dimmed">
          <span className="num">
            {firstRow}–{lastRow}
          </span>{' '}
          of <span className="num">{meta.total}</span>
        </Text>
        {extra}
      </Group>
      <Group gap={6}>
        <Button size="compact-sm" variant="default" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          Previous
        </Button>
        <Button size="compact-sm" variant="default" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next
        </Button>
      </Group>
    </Group>
  )
}
