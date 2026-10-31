import type { CSSProperties } from 'react'
import type { HistoryEntry, SubscriptionStatus } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { SUBSCRIPTION_STATUS } from '@/lib/labels'
import { CLOSE_REASON_LABEL, TRACK } from './constants'
import classes from './StatusTrack.module.css'

interface Props {
  status: SubscriptionStatus
  history: HistoryEntry[]
  quotationValidUntil?: string | null
  nextInvoiceDate?: string | null
  closeReason?: string | null
  pausedAt?: string | null
}

/**
 * Draft → Quotation → Confirmed → Active → Closed as small steps; the current one is emphasised.
 * Paused hangs off Active as a side state rather than a step of its own.
 */
export function StatusTrack({ status, history, quotationValidUntil, nextInvoiceDate, closeReason, pausedAt }: Props) {
  const reached = new Set<string>(history.map((h) => h.to).filter((s): s is string => Boolean(s)))
  reached.add('draft')
  const trackStatus: SubscriptionStatus = status === 'paused' ? 'active' : status
  reached.add(trackStatus)
  // Newest first, so the first match is the latest time it got there.
  const reachedOn = (s: string) => history.find((h) => h.to === s)?.at

  const metaFor = (step: SubscriptionStatus): string | null => {
    if (step === 'quotation' && status === 'quotation' && quotationValidUntil) return `Valid until ${formatDate(quotationValidUntil)}`
    if (step === 'active' && status === 'active' && nextInvoiceDate) return `Next invoice ${formatDate(nextInvoiceDate)}`
    if (step === 'closed' && status === 'closed') return closeReason ? (CLOSE_REASON_LABEL[closeReason] ?? closeReason) : null
    const at = reached.has(step) ? reachedOn(step) : undefined
    return at ? formatDate(at) : null
  }

  return (
    <ol className={classes.track} aria-label="Subscription progress">
      {TRACK.map((step, i) => {
        const isCurrent = step === trackStatus && status !== 'paused'
        const isDone = !isCurrent && reached.has(step)
        const color = SUBSCRIPTION_STATUS[step].color
        const meta = metaFor(step)
        const className = [classes.step, isCurrent ? classes.current : isDone ? classes.done : ''].join(' ')
        return (
          <li key={step} className={className} style={{ '--step-color': color } as CSSProperties} aria-current={isCurrent ? 'step' : undefined}>
            <div className={classes.rail}>
              <span className={classes.dot} />
              {i < TRACK.length - 1 && <span className={classes.line} />}
            </div>
            <div className={classes.label}>{SUBSCRIPTION_STATUS[step].label}</div>
            {meta && <div className={classes.meta}>{meta}</div>}
            {step === 'active' && status === 'paused' && (
              <div
                className={`${classes.side} ${classes.sideCurrent}`}
                style={{ '--step-color': SUBSCRIPTION_STATUS.paused.color } as CSSProperties}
                aria-current="step"
              >
                <span className={classes.sideDot} />
                Paused{pausedAt ? ` since ${formatDate(pausedAt)}` : ''}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
