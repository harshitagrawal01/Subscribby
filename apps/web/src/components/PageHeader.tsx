import { Group, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-end" mb={24} wrap="wrap" gap="md">
      <div>
        <Title order={1} fz={22}>
          {title}
        </Title>
        {description && (
          <Text c="dimmed" size="sm" mt={4}>
            {description}
          </Text>
        )}
      </div>
      {actions && <Group gap={8}>{actions}</Group>}
    </Group>
  )
}
