import { Alert, Center, Loader } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { isApiError } from '@/lib/api/client'

/** Standard loading and error display for a TanStack Query result. */
export function QueryState({ isLoading, error }: { isLoading: boolean; error: unknown }) {
  if (isLoading)
    return (
      <Center py="xl">
        <Loader />
      </Center>
    )
  if (error)
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />} title="Couldn't load this">
        {isApiError(error) ? error.message : 'Something went wrong.'}
      </Alert>
    )
  return null
}
