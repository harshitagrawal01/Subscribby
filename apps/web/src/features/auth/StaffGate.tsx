import { useEffect } from 'react'
import { Outlet, useParams } from 'react-router'
import { NotFoundPage } from '@/pages/ErrorPages'
import { isStaffSegment, rememberStaffBase } from './staff-base'

/**
 * Mounted at "/:staffSegment". The real secret segment opens the staff console;
 * any other segment gets the exact same 404 as an unknown page, so probing reveals nothing.
 */
export function StaffGate() {
  const { staffSegment } = useParams()
  const allowed = isStaffSegment(staffSegment)
  if (allowed && staffSegment) rememberStaffBase(staffSegment)

  // Keep the console out of search engines (deliberately not listed in robots.txt, which would reveal it).
  useEffect(() => {
    if (!allowed) return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [allowed])

  return allowed ? <Outlet /> : <NotFoundPage />
}
