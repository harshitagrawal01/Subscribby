import { Badge, Card, Code, Group, List, Stack, Text } from '@mantine/core'
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
      <PageHeader title={title} description={`Who sees this: ${who}`} actions={<Badge color="orange">To build</Badge>} />
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <div>
            <Text fw={600} mb={6}>
              On this screen
            </Text>
            <List size="sm" spacing={4}>
              {todo.map((item) => (
                <List.Item key={item}>{item}</List.Item>
              ))}
            </List>
          </div>
          <div>
            <Text fw={600} mb={6}>
              Endpoints
            </Text>
            <Group gap={6}>
              {endpoints.map((e) => (
                <Code key={e}>{e}</Code>
              ))}
            </Group>
          </div>
        </Stack>
      </Card>
    </>
  )
}
