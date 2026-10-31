import { Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import classes from './ProfileSection.module.css'

/** A settings block: title and a line of context on the left, the form on the right. */
export function ProfileSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className={`panel ${classes.section}`}>
      <div>
        <Title order={2} fz={16}>
          {title}
        </Title>
        {description && (
          <Text size="sm" c="dimmed" mt={4}>
            {description}
          </Text>
        )}
      </div>
      <div>{children}</div>
    </section>
  )
}

/** A value the person can see but not change here. */
export function ReadOnlyField({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div>
      <Text size="sm" fw={500} mb={2}>
        {label}
      </Text>
      <Text size="md">{value || <Text span c="dimmed">—</Text>}</Text>
      {note && (
        <Text size="xs" c="dimmed" mt={2}>
          {note}
        </Text>
      )}
    </div>
  )
}
