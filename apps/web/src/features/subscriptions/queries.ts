import { useDebouncedValue } from '@mantine/hooks'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import { customersApi, plansApi, productsApi, subscriptionsApi, templatesApi, usersApi } from '@/lib/api/endpoints'
import type { BillingPeriod, Ref, SubscriptionInput } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { PERIOD_NOUN } from './constants'
import type { PreviewResult } from './lines'

/** Catalog lists are small; one page of 100 covers them. */
export const useProducts = () =>
  useQuery({ queryKey: ['products', 'options'], queryFn: () => productsApi.list({ limit: 100 }), staleTime: 60_000, select: (r) => r.data })

export const usePlans = () =>
  useQuery({ queryKey: ['plans', 'options'], queryFn: () => plansApi.list({ limit: 100 }), staleTime: 60_000, select: (r) => r.data })

export const useActiveTemplates = () =>
  useQuery({
    queryKey: ['quotation-templates', 'options'],
    queryFn: () => templatesApi.list({ limit: 100, isActive: true }),
    staleTime: 60_000,
    select: (r) => r.data,
  })

export const planOptionLabel = (p: { name: string; price: number; billingPeriod: BillingPeriod }) =>
  `${p.name} · ${formatMoney(p.price)} per ${PERIOD_NOUN[p.billingPeriod]}`

/** Customers are many, so the select searches on the server. */
export function useCustomerSearch(search: string, selected: Ref | null) {
  const [debounced] = useDebouncedValue(search.trim(), 250)
  const query = useQuery({
    queryKey: ['customers', 'options', debounced],
    queryFn: () => customersApi.list({ search: debounced || undefined, limit: 20, isActive: true, sort: 'name' }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const options = useMemo(() => {
    const rows = query.data?.data.map((c) => ({ value: c.id, label: c.name })) ?? []
    if (selected && !rows.some((r) => r.value === selected.id)) rows.unshift({ value: selected.id, label: selected.name })
    return rows
  }, [query.data, selected])
  return { options, isFetching: query.isFetching, error: query.error }
}

/**
 * People who can own a quotation. Listing users is admin-only, so staff see themselves
 * (and whoever already owns the subscription).
 */
export function useSalespeople(current?: Ref | null) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const users = useQuery({
    queryKey: ['users', 'salespeople'],
    queryFn: () => usersApi.list({ limit: 100, status: 'active', sort: 'name' }),
    enabled: isAdmin,
    staleTime: 60_000,
  })
  return useMemo(() => {
    const rows: { value: string; label: string }[] = []
    if (isAdmin && users.data) {
      for (const u of users.data.data) if (u.role === 'admin' || u.role === 'staff') rows.push({ value: u.id, label: u.name })
    }
    if (user && user.role !== 'customer' && !rows.some((r) => r.value === user.id)) rows.unshift({ value: user.id, label: `${user.name} (you)` })
    else if (user) {
      const me = rows.find((r) => r.value === user.id)
      if (me) me.label = `${user.name} (you)`
    }
    if (current && !rows.some((r) => r.value === current.id)) rows.push({ value: current.id, label: current.name })
    return rows
  }, [isAdmin, users.data, user, current])
}

/**
 * Live pricing from POST /subscriptions/preview, debounced. The browser never prices anything.
 * `indexMap` travels with the result so priced lines line up with editor rows.
 */
export function useLivePreview(body: SubscriptionInput | null, indexMap: number[]) {
  const key = body ? JSON.stringify({ body, indexMap }) : ''
  const [debouncedKey] = useDebouncedValue(key, 400)
  const query = useQuery({
    queryKey: ['subscriptions', 'preview', debouncedKey],
    queryFn: async () => {
      const parsed = JSON.parse(debouncedKey) as { body: SubscriptionInput; indexMap: number[] }
      const result = (await subscriptionsApi.preview(parsed.body)) as PreviewResult
      return { ...result, indexMap: parsed.indexMap }
    },
    enabled: Boolean(debouncedKey),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 15_000,
  })
  // Keep the last good totals on screen while the next answer (or an error) is on its way.
  const [lastGood, setLastGood] = useState<typeof query.data>(undefined)
  if (query.data && !query.isError && query.data !== lastGood) setLastGood(query.data)
  const settled = key === debouncedKey && !query.isFetching
  return {
    data: key ? (query.isError ? lastGood : query.data) : undefined,
    error: key && settled ? query.error : null,
    /** True while typing has outrun the last answer. */
    updating: Boolean(key) && !settled,
    /** The numbers on screen are from an earlier, valid version of the quote. */
    stale: Boolean(key) && query.isError,
    errorIndexMap: indexMap,
  }
}
