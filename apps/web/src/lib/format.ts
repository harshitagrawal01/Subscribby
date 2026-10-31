import dayjs from 'dayjs'
import type { Paise } from './api/types'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const inrCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 })

/** 12814800 → "₹1,28,148.00". The API always sends paise. */
export const formatMoney = (paise: Paise | null | undefined) => (paise == null ? '—' : inr.format(paise / 100))

/** 96000000 → "₹9.6L" style short form for KPI tiles. */
export const formatMoneyCompact = (paise: Paise | null | undefined) => (paise == null ? '—' : inrCompact.format(paise / 100))

/** Form inputs are in rupees; the API wants whole paise. */
export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100)
export const paiseToRupees = (paise: Paise) => paise / 100

/** "2026-10-31" → "31 Oct 2026" */
export const formatDate = (date: string | null | undefined) => (date ? dayjs(date).format('DD MMM YYYY') : '—')
export const formatDateTime = (ts: string | null | undefined) => (ts ? dayjs(ts).format('DD MMM YYYY, h:mm A') : '—')

/** Today as "YYYY-MM-DD" in the browser's zone (the team is in IST, matching the API). */
export const today = () => dayjs().format('YYYY-MM-DD')

export const pluralize = (count: number, word: string, plural = `${word}s`) => `${count} ${count === 1 ? word : plural}`
