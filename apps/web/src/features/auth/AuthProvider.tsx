import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onSessionError, tokenStore } from '@/lib/api/client'
import { authApi } from '@/lib/api/endpoints'
import type { AuthUser, Portal, Session } from '@/lib/api/types'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()))

  const applySession = useCallback((session: Session) => {
    tokenStore.set(session.token)
    setUser(session.user)
    return session.user
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return
    try {
      setUser(await authApi.me())
    } catch {
      tokenStore.clear()
      setUser(null)
    }
  }, [])

  // Restore the session on first load.
  useEffect(() => {
    if (!tokenStore.get()) return
    refresh().finally(() => setLoading(false))
  }, [refresh])

  // React to session errors from any API call.
  useEffect(
    () =>
      onSessionError((error) => {
        if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
          setUser((u) => (u ? { ...u, mustChangePassword: true } : u))
        } else {
          logout()
        }
      }),
    [logout],
  )

  const login = useCallback(
    async (portal: Portal, email: string, password: string) => {
      const session =
        portal === 'customer' ? await authApi.customerLogin({ email, password }) : await authApi.staffLogin({ email, password })
      queryClient.clear()
      return applySession(session)
    },
    [applySession, queryClient],
  )

  const signup = useCallback<AuthContextValue['signup']>(
    async (input) => applySession(await authApi.customerSignup(input)),
    [applySession],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, signup, applySession, logout, refresh }),
    [user, loading, login, signup, applySession, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
