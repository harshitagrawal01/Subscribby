import { useSearchParams } from 'react-router'

/** Filters live in the URL so lists are shareable and survive a refresh. Changing a filter resets the page. */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams()
  const update = (changes: Record<string, string | undefined | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }
  const clear = () => setParams(new URLSearchParams(), { replace: true })
  return { params, update, clear, get: (key: string) => params.get(key) ?? undefined }
}
