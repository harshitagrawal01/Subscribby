import { Center, Loader } from '@mantine/core'
import { Navigate, Outlet, useLocation } from 'react-router'
import type { Portal, Role } from '@/lib/api/types'
import { ForbiddenPage } from '@/pages/ErrorPages'
import { homePathFor, portalOf, portalPaths } from './session'
import { useAuth } from './useAuth'

function FullPageLoader() {
  return (
    <Center h="100vh">
      <Loader />
    </Center>
  )
}

/** Protects a whole portal: must be logged in, in the right portal, and not owe a password change. */
export function RequireAuth({ portal }: { portal: Portal }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const paths = portalPaths(portal)

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to={paths.login} replace state={{ from: location.pathname + location.search }} />
  if (portalOf(user.role) !== portal) return <Navigate to={homePathFor(user)} replace />
  if (user.mustChangePassword && location.pathname !== paths.setPassword) return <Navigate to={paths.setPassword} replace />
  return <Outlet />
}

/** Login, sign-up and forgot pages: a logged-in user goes straight to their home. */
export function GuestOnly() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (user) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

/** Limits one staff page to some roles (matches the Who columns in the spec). */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) return <ForbiddenPage />
  return <Outlet />
}
