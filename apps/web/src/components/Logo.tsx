import { Group, Text } from '@mantine/core'

const BACK = 'M11.4 3 H24.6 A2.4 2.4 0 0 1 27 5.4 V24 l-3.000 -2.0 l-3.000 2.0 l-3.000 -2.0 l-3.000 2.0 l-3.000 -2.0 l-3.000 2.0 V5.4 A2.4 2.4 0 0 1 11.4 3 Z'
const FRONT = 'M7.4 7 H20.6 A2.4 2.4 0 0 1 23 9.4 V28.5 l-3.000 -2.0 l-3.000 2.0 l-3.000 -2.0 l-3.000 2.0 l-3.000 -2.0 l-3.000 2.0 V9.4 A2.4 2.4 0 0 1 7.4 7 Z'

/**
 * Subscribby mark: two receipts, one tucked behind the other (bills that keep coming),
 * with a punched dot. `light` is for dark backgrounds.
 */
export function LogoMark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  const ink = light ? '#FBF7EF' : '#1D2B44'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Subscribby" style={{ flex: 'none' }}>
      <g transform="rotate(9 18 14)">
        <path d={BACK} fill={ink} />
      </g>
      <g transform="rotate(-5 14 18)">
        <path d={FRONT} fill="#F2B544" />
        <path d="M9.5 13.2 H18.5 M9.5 17.4 H15.5" stroke="#1D2B44" strokeWidth="2.1" strokeLinecap="round" />
        <circle cx="17.6" cy="21.6" r="2.3" fill="#1D2B44" />
      </g>
    </svg>
  )
}

/** Mark + "subscribby" wordmark. `tag` adds a small label after it (e.g. "staff"). */
export function Logo({ size = 'md', light = false, tag }: { size?: 'sm' | 'md' | 'lg'; light?: boolean; tag?: string }) {
  const mark = { sm: 24, md: 30, lg: 38 }[size]
  const word = { sm: 19, md: 23, lg: 29 }[size]
  return (
    <Group gap={size === 'lg' ? 10 : 8} wrap="nowrap" align="center">
      <LogoMark size={mark} light={light} />
      <span className="wordmark" style={{ fontSize: word, color: light ? '#FBF7EF' : '#1D2B44' }}>
        subscribby
      </span>
      {tag && (
        <Text span size="xs" c="dimmed" fw={500} ml={2} mt={3}>
          {tag}
        </Text>
      )}
    </Group>
  )
}
