import { SimpleGrid, Text } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { PASSWORD_RULES } from '@/lib/validation'
import { tokens } from '@/theme'

/** Quiet live checklist under a new-password field. */
export function PasswordRules({ value }: { value: string }) {
  return (
    <SimpleGrid cols={2} spacing={4} verticalSpacing={2} aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value)
        return (
          <Text key={rule.id} size="xs" c={ok ? tokens.status.good : tokens.faint} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {ok ? (
              <IconCheck size={12} stroke={2} />
            ) : (
              <span aria-hidden style={{ width: 12, display: 'inline-flex', justifyContent: 'center' }}>
                ·
              </span>
            )}
            {rule.label}
          </Text>
        )
      })}
    </SimpleGrid>
  )
}
