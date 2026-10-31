import { Code, Group, List, Stack, Text } from '@mantine/core'
import { PageHeader } from './PageHeader'

interface Props {
  title: string
  who: string
  /** What this screen must show or do. */
  todo: string[]
  /** Endpoints it uses, e.g. "GET /plans". All exist in the mock API. */
  endpoints: string[]
}

/** Stand-in for a screen that isn't built yet. Doubles as its task list. */
export function ScreenPlaceholder({ title, who, todo, endpoints }: Props) {
  return (
    <>
      <PageHeader title={title} description={`Not built yet · ${who}`} />
      <div className="panel" style={{ padding: 24, maxWidth: 760 }}>
        <Stack gap="lg">
          <div>
            <Text fw={500} mb={8}>
              This screen needs
            </Text>
            <List size="sm" spacing={6} c="dimmed">
              {todo.map((item) => (
                <List.Item key={item}>{item}</List.Item>
              ))}
            </List>
          </div>
          <div>
            <Text fw={500} mb={8}>
              API
            </Text>
            <Group gap={6}>
              {endpoints.map((e) => (
                <Code key={e} fz="xs">
                  {e}
                </Code>
              ))}
            </Group>
          </div>
        </Stack>
      </div>
    </>
  )
}
