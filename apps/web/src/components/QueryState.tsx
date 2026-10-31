import { Button, Group, Skeleton, Stack, Text } from '@mantine/core'
import { isApiError } from '@/lib/api/client'
import { tokens } from '@/theme'

interface Props {
  isLoading: boolean
  error: unknown
  onRetry?: () => void
  /** Number of skeleton rows to show while loading. */
  rows?: number
  /** What was being loaded, for the error line ("invoices"). */
  what?: string
}

/** Skeleton rows while loading; one line and "Try again" on error. */
export function QueryState({ isLoading, error, onRetry, rows = 5, what = 'this' }: Props) {
  if (isLoading)
    return (
      <Stack gap={14} p="md" aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <Group key={i} gap="md" wrap="nowrap">
            <Skeleton h={10} w="18%" radius="xs" />
            <Skeleton h={10} w="32%" radius="xs" />
            <Skeleton h={10} w="20%" radius="xs" />
            <Skeleton h={10} w="12%" radius="xs" ml="auto" />
          </Group>
        ))}
      </Stack>
    )
  if (error)
    return (
      <Group p="md" gap="sm" wrap="wrap">
        <Text size="sm" c={tokens.status.bad}>
          Couldn't load {what}. {isApiError(error) && error.code === 'NETWORK_ERROR' ? "The server isn't responding." : isApiError(error) ? error.message : ''}
        </Text>
        {onRetry && (
          <Button size="compact-sm" variant="default" onClick={onRetry}>
            Try again
          </Button>
        )}
      </Group>
    )
  return null
}
