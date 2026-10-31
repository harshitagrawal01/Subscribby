import { reportsApi } from '@/lib/api/endpoints'
import type { QueryParams } from '@/lib/api/client'
import { today } from '@/lib/format'

export type ExportType = 'invoices' | 'payments' | 'subscriptions'

/** The export needs the auth header, so fetch it and hand the browser a Blob instead of a plain link. */
export async function downloadCsv(type: ExportType, filters: QueryParams = {}) {
  const csv = await reportsApi.exportCsv(type, filters)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `subscribby-${type}-${today()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
