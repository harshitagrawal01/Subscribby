import { NumberInput, type NumberInputProps } from '@mantine/core'
import type { Paise } from '@/lib/api/types'

interface Props extends Omit<NumberInputProps, 'value' | 'onChange' | 'prefix'> {
  /** Value in paise (what the API uses). */
  value: Paise | null | undefined
  onChange: (paise: Paise | null) => void
}

/** People type rupees; the form keeps paise. */
export function MoneyInput({ value, onChange, ...rest }: Props) {
  return (
    <NumberInput
      prefix="₹"
      thousandSeparator=","
      thousandsGroupStyle="lakh"
      decimalScale={2}
      min={0}
      hideControls
      value={value == null ? '' : value / 100}
      onChange={(v) => onChange(v === '' || v == null ? null : Math.round(Number(v) * 100))}
      styles={{ input: { fontVariantNumeric: 'tabular-nums' } }}
      {...rest}
    />
  )
}
