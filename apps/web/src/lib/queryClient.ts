import { QueryClient } from '@tanstack/react-query'
import { isApiError } from './api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry client errors (400s); retry network or server errors once.
      retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 1,
    },
  },
})
