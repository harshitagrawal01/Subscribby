import { Anchor, Box, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'
import { Logo } from '@/components/Logo'

/** Plain 404. Also shown for wrong staff console paths, so it must look like any other missing page. */
export function NotFoundPage() {
  return (
    <Box px={{ base: 24, sm: 48 }} py={{ base: 28, sm: 40 }}>
      <Logo size="md" />
      <Stack gap={8} maw={460} mt={{ base: 56, sm: 96 }}>
        <Text className="mono" c="dimmed" size="sm">
          404
        </Text>
        <Title order={1} fz={24}>
          This page doesn't exist
        </Title>
        <Text c="dimmed">Check the address for typos, or start again from the login page.</Text>
        <Anchor component={Link} to="/login" fw={500} mt={8} w="fit-content">
          Go to log in
        </Anchor>
      </Stack>
    </Box>
  )
}

export function ForbiddenPage() {
  return (
    <Stack gap={8} maw={460} py={48}>
      <Title order={1} fz={22}>
        You don't have access to this page
      </Title>
      <Text c="dimmed">It's limited to admins. If you need it for your work, ask an admin to change your access level.</Text>
    </Stack>
  )
}
