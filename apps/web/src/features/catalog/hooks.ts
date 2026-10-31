import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { productsApi } from '@/lib/api/endpoints'
import type { Product, Role } from '@/lib/api/types'

/**
 * Filters live in the URL so a list survives refresh and can be shared.
 * `update` sets or clears keys and resets the page unless the page itself changes.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams()
  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes) && !('edit' in changes) && !('tab' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }
  const clear = (keep: string[] = []) => {
    const next = new URLSearchParams()
    for (const key of keep) {
      const value = params.get(key)
      if (value) next.set(key, value)
    }
    setParams(next, { replace: true })
  }
  return { params, update, clear }
}

/** The open drawer/modal is part of the URL too: ?edit=new or ?edit=<id>. */
export function useEditParam() {
  const { params, update } = useUrlFilters()
  const editing = params.get('edit')
  return {
    editing,
    isNew: editing === 'new',
    openNew: () => update({ edit: 'new' }),
    openEdit: (id: string) => update({ edit: id }),
    close: () => update({ edit: undefined }),
  }
}

export function useRole() {
  const { user } = useAuth()
  const role = user?.role as Role | undefined
  return { role, can: (...roles: Role[]) => Boolean(role && roles.includes(role)) }
}

/** Every product (active and archived) for pickers and for turning ids into names. */
export function useProductOptions() {
  const query = useQuery({
    queryKey: ['products', 'options'],
    queryFn: () => productsApi.list({ limit: 100, sort: 'name' }),
    staleTime: 60_000,
  })
  const all = useMemo(() => query.data?.data ?? [], [query.data])
  const byId = useMemo(() => new Map<string, Product>(all.map((p) => [p.id, p])), [all])
  /** Archived products can't be picked again, but stay listed when already chosen. */
  const options = (selected: string[] = []) =>
    all.filter((p) => p.isActive || selected.includes(p.id)).map((p) => ({ value: p.id, label: p.isActive ? p.name : `${p.name} (archived)` }))
  return { query, all, byId, options }
}

/** Lets a drawer footer outside the customer form show the saving state: useIsMutating({ mutationKey: CUSTOMER_SAVE_KEY }). */
export const CUSTOMER_SAVE_KEY = ['customers', 'save']

/**
 * Cross-field checks (until ≥ from, rate by type) run even when another field is still empty,
 * so every problem shows on the first submit instead of one round at a time.
 */
export const ALWAYS_CHECK = { when: () => true }
