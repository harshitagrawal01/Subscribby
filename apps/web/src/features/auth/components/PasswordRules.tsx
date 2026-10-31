import { List, ThemeIcon } from '@mantine/core'
import { IconCheck, IconPoint } from '@tabler/icons-react'
import { PASSWORD_RULES } from '@/lib/validation'

/** Live checklist under a new-password field. */
export function PasswordRules({ value }: { value: string }) {
  return (
    <List spacing={2} size="xs" center>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value)
        return (
          <List.Item
            key={rule.id}
            c={ok ? 'teal' : 'dimmed'}
            icon={
              <ThemeIcon size={14} radius="xl" color={ok ? 'teal' : 'gray'} variant={ok ? 'filled' : 'light'}>
                {ok ? <IconCheck size={10} /> : <IconPoint size={10} />}
              </ThemeIcon>
            }
          >
            {rule.label}
          </List.Item>
        )
      })}
    </List>
  )
}
