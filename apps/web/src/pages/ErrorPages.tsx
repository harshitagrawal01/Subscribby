import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <Center mih="60vh">
      <Stack align="center" gap="xs">
        <Title order={1}>404</Title>
        <Text c="dimmed">This page doesn't exist.</Text>
        <Button component={Link} to="/" variant="light">
          Go home
        </Button>
      </Stack>
    </Center>
  )
}

export function ForbiddenPage() {
  return (
    <Center mih="60vh">
      <Stack align="center" gap="xs">
        <Title order={2}>No access</Title>
        <Text c="dimmed">Your role can't open this page. Ask an admin if you need it.</Text>
      </Stack>
    </Center>
  )
}
