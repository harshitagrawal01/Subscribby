import { DatePickerInput } from '@mantine/dates'
import dayjs from 'dayjs'

interface Props {
  label: string
  from?: string
  to?: string
  onChange: (from: string | undefined, to: string | undefined) => void
  w?: number
}

/** One input for a from/to pair of "YYYY-MM-DD" URL params. */
export function DateRangeFilter({ label, from, to, onChange, w = 230 }: Props) {
  return (
    <DatePickerInput
      type="range"
      aria-label={label}
      placeholder={label}
      valueFormat="DD MMM YYYY"
      clearable
      allowSingleDateInRange
      value={[from ?? null, to ?? null]}
      onChange={([start, end]) => {
        // Wait for both ends unless the range was cleared.
        if (start && !end) return
        onChange(start ? dayjs(start).format('YYYY-MM-DD') : undefined, end ? dayjs(end).format('YYYY-MM-DD') : undefined)
      }}
      w={w}
    />
  )
}
