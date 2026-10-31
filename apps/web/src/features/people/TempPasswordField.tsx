import { ActionIcon, Button, CopyButton, Group, PasswordInput, Stack, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconEye, IconEyeOff, IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'
import { PasswordRules } from '@/features/auth/components/PasswordRules'
import { generatePassword } from './access'

interface Props {
  value: string
  onChange: (value: string) => void
  error?: string
  label?: string
  description?: string
}

/**
 * Temporary password input for admins: type one or generate a compliant one, copy it to share,
 * and watch the password rule tick off live. Generating reveals the value so it can be read out.
 */
export function TempPasswordField({ value, onChange, error, label = 'Temporary password', description }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <Stack gap={6}>
      <Group gap={8} align="flex-end" wrap="nowrap">
        <PasswordInput
          label={label}
          description={description}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          error={error}
          visible={visible}
          onVisibilityChange={setVisible}
          style={{ flex: 1 }}
          styles={{ input: { fontFamily: visible ? 'var(--mantine-font-family-monospace)' : undefined } }}
          rightSectionWidth={60}
          rightSection={
            <Group gap={0} wrap="nowrap">
              <CopyButton value={value} timeout={1600}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied' : 'Copy password'} withArrow>
                    <ActionIcon
                      variant="subtle"
                      color={copied ? 'green' : 'gray'}
                      onClick={copy}
                      disabled={!value}
                      aria-label="Copy password"
                      size="sm"
                    >
                      {copied ? <IconCheck size={15} stroke={1.75} /> : <IconCopy size={15} stroke={1.5} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
              <PasswordToggle visible={visible} onToggle={() => setVisible((v) => !v)} />
            </Group>
          }
        />
        <Button
          variant="default"
          leftSection={<IconRefresh size={15} stroke={1.5} />}
          onClick={() => {
            onChange(generatePassword())
            setVisible(true)
          }}
          mb={error ? 22 : 0}
        >
          Generate
        </Button>
      </Group>
      <PasswordRules value={value} />
    </Stack>
  )
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <Tooltip label={visible ? 'Hide password' : 'Show password'} withArrow>
      <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'}>
        {visible ? <IconEyeOff size={15} stroke={1.5} /> : <IconEye size={15} stroke={1.5} />}
      </ActionIcon>
    </Tooltip>
  )
}
