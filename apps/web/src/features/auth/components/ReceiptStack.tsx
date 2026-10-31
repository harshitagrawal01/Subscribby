import { Divider, Group, Stack, Text } from '@mantine/core'
import type { CSSProperties, ReactNode } from 'react'
import { LogoMark } from '@/components/Logo'
import { StatusText } from '@/components/StatusBadge'
import { tokens } from '@/theme'

/** Torn-paper bottom edge for a receipt. */
function tornEdge(teeth = 16, depth = 7) {
  const step = 100 / teeth
  const points = ['0 0', '100% 0', `100% calc(100% - ${depth}px)`]
  for (let i = 1; i <= teeth; i++) {
    const x = (100 - i * step).toFixed(2)
    points.push(i % 2 ? `${x}% 100%` : `${x}% calc(100% - ${depth}px)`)
  }
  return `polygon(${points.join(', ')})`
}

function Receipt({ children, style, width }: { children: ReactNode; style?: CSSProperties; width: number }) {
  return (
    <div style={{ position: 'absolute', filter: 'drop-shadow(0 14px 22px rgba(60, 45, 20, 0.16))', ...style }}>
      <div style={{ width, background: '#FFFEFB', padding: '24px 26px 34px', clipPath: tornEdge() }}>{children}</div>
    </div>
  )
}

const Line = ({ label, sub, amount, muted }: { label: string; sub?: string; amount: string; muted?: boolean }) => (
  <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
    <div>
      <Text size="sm" c={muted ? 'dimmed' : undefined}>
        {label}
      </Text>
      {sub && (
        <Text size="xs" c="dimmed">
          {sub}
        </Text>
      )}
    </div>
    <Text size="sm" className="num" c={muted ? 'dimmed' : undefined}>
      {amount}
    </Text>
  </Group>
)

/** Last month's paid receipt under this month's bill, plus a handwritten reminder. */
export function ReceiptStack() {
  return (
    <div style={{ position: 'relative', width: 420, height: 470 }} aria-hidden>
      {/* last month, paid */}
      <Receipt width={300} style={{ top: 0, right: 0, transform: 'rotate(5deg)' }}>
        <Group justify="space-between" mb="md" align="flex-start">
          <Text className="mono" size="sm" c="dimmed">
            INV/2026/0277
          </Text>
          <div
          style={{
            display: 'inline-block',
            border: `2px solid ${tokens.status.good}`,
            color: tokens.status.good,
            borderRadius: 6,
            padding: '2px 10px',
            transform: 'rotate(-8deg) translateY(-4px)',
            fontWeight: 600,
            letterSpacing: '0.12em',
            fontSize: 13,
            opacity: 0.85,
          }}
        >
          PAID · 3 OCT
        </div>
        </Group>
        <Stack gap={8} opacity={0.55}>
          <Line label="Starter plan" amount="₹3,000.00" />
          <Line label="GST 18%" amount="₹540.00" />
        </Stack>
      </Receipt>

      {/* this month, due */}
      <Receipt width={330} style={{ top: 70, left: 0, transform: 'rotate(-3deg)' }}>
        <Group justify="space-between" align="center" mb="lg">
          <Group gap={8}>
            <LogoMark size={22} />
            <Text fw={600} size="sm">
              Subscribby
            </Text>
          </Group>
          <StatusText label="Unpaid" color={tokens.status.info} />
        </Group>
        <Group justify="space-between" mb="lg" align="flex-end">
          <div>
            <Text size="xs" c="dimmed">
              Invoice
            </Text>
            <Text className="mono" fw={500}>
              INV/2026/0311
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text size="xs" c="dimmed">
              Billed to
            </Text>
            <Text size="sm" fw={500}>
              Kite Stores
            </Text>
          </div>
        </Group>
        <Stack gap={10}>
          <Line label="Starter plan" sub="1 seat · 10 Nov to 9 Dec" amount="₹3,000.00" />
          <Line label="Launch offer" amount="−₹500.00" muted />
          <Line label="GST 18%" amount="₹450.00" muted />
        </Stack>
        <Divider my="md" color={tokens.line} variant="dashed" />
        <Group justify="space-between" align="flex-end">
          <div>
            <Text size="xs" c="dimmed">
              Due 10 Nov 2026
            </Text>
            <Text size="sm" fw={500}>
              Total
            </Text>
          </div>
          <Text className="num" fz={26} fw={600} lh={1}>
            ₹2,950.00
          </Text>
        </Group>
      </Receipt>

      {/* handwritten note + arrow */}
      <div style={{ position: 'absolute', left: 12, bottom: 4, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <span
          style={{
            fontFamily: '"Fraunces Variable", Georgia, serif',
            fontStyle: 'italic',
            fontSize: 21,
            color: tokens.ink,
            transform: 'rotate(-4deg)',
            fontVariationSettings: "'SOFT' 100, 'WONK' 1, 'opsz' 36",
          }}
        >
          next one's on 10 Nov
        </span>
        <svg width="58" height="46" viewBox="0 0 58 46" fill="none" style={{ marginBottom: 14 }}>
          <path d="M3 40 C 18 38, 34 30, 46 10" stroke={tokens.ink} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M38 12.5 L46.5 9 L48 18" stroke={tokens.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
