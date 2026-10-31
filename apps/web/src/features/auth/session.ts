import type { AuthUser, Portal, Role } from '@/lib/api/types'
import { staffPath } from './staff-base'

export const STAFF_ROLES: Role[] = ['admin', 'staff', 'finance']

export const portalOf = (role: Role): Portal => (role === 'customer' ? 'customer' : 'staff')

/**
 * Each portal's URLs (spec section 5: two login pages, one account system).
 * Staff URLs sit under the secret console path, so they're computed at call time.
 */
export function portalPaths(portal: Portal) {
  if (portal === 'customer') {
    return {
      home: '/portal',
      login: '/login',
      forgot: '/forgot-password',
      reset: '/reset-password',
      setPassword: '/set-password',
    }
  }
  return {
    home: staffPath('/dashboard'),
    login: staffPath('/login'),
    forgot: staffPath('/forgot-password'),
    reset: staffPath('/reset-password'),
    setPassword: staffPath('/set-password'),
  }
}

export const homePathFor = (user: Pick<AuthUser, 'role'>) => portalPaths(portalOf(user.role)).home
