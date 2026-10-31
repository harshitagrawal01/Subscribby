import { createContext } from 'react'
import type { AuthUser, Portal, Session } from '@/lib/api/types'

export interface AuthContextValue {
  user: AuthUser | null
  /** True until the saved token has been checked against /auth/me. */
  loading: boolean
  login: (portal: Portal, email: string, password: string) => Promise<AuthUser>
  signup: (input: { name: string; companyName?: string; email: string; password: string }) => Promise<AuthUser>
  /** Store a session returned by reset-password or change-password. */
  applySession: (session: Session) => AuthUser
  logout: () => void
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
