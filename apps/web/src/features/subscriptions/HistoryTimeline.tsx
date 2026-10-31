import { Box, Group, Stack, Text } from '@mantine/core'
import type { HistoryEntry, SubscriptionStatus } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { SUBSCRIPTION_STATUS } from '@/lib/labels'
import { tokens } from '@/theme'
import { HISTORY_LABEL } from './constants'
import { humanizeDates } from './errors'

const statusColor = (s: string | null) => (s && s in SUBSCRIPTION_STATUS ? SUBSCRIPTION_STATUS[s as SubscriptionStatus].color : tokens.faint)

/** Everything that happened to the subscription, newest first (the API already sorts it). */
export function HistoryTimeline({ history }: { history: HistoryEntry[] }) {
  if (!history.length)
    return (
      <Text size="sm" c="dimmed">
        Nothing has happened yet.
      </Text>
    )
  return (
    <Stack gap={0} component="ol" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {history.map((h, i) => {
        const moved = h.from !== h.to && h.to
        return (
          <Group key={`${h.at}-${i}`} component="li" gap={12} wrap="nowrap" align="stretch">
            <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 9, flex: 'none' }}>
              <span
                aria-hidden
                style={{ width: 7, height: 7, borderRadius: 7, marginTop: 6, background: moved ? statusColor(h.to) : tokens.line, flex: 'none' }}
              />
              {i < history.length - 1 && <span aria-hidden style={{ width: 1, flex: 1, background: tokens.line, marginTop: 4 }} />}
            </Box>
            <Box pb={14} style={{ minWidth: 0 }}>
              <Text size="sm" fw={500}>
                {HISTORY_LABEL[h.action] ?? h.action}
              </Text>
              {h.note && (
                <Text size="xs" c="gray.7" mt={1}>
                  {humanizeDates(h.note.replace(' → ', ' to ').replace(/^Edited: /, 'Changed '))}
                </Text>
              )}
              <Text size="xs" c="dimmed" mt={1}>
                {h.by.name} · {formatDateTime(h.at)}
              </Text>
            </Box>
          </Group>
        )
      })}
    </Stack>
  )
}
