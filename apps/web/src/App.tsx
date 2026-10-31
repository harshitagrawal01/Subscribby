import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { RouterProvider } from 'react-router'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router'
import { cssVariablesResolver, theme } from '@/theme'

// Query devtools only when asked for: VITE_QUERY_DEVTOOLS=true in .env.local
const Devtools =
  import.meta.env.DEV && import.meta.env.VITE_QUERY_DEVTOOLS === 'true'
    ? lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })))
    : null

export default function App() {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="light">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        {Devtools && (
          <Suspense>
            <Devtools initialIsOpen={false} buttonPosition="bottom-right" />
          </Suspense>
        )}
      </QueryClientProvider>
    </MantineProvider>
  )
}
