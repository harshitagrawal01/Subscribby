import { Anchor, Badge, Box, Center, Group, Paper, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { config } from '@/config'
import type { Portal } from '@/lib/api/types'
import { staffPath } from '../staff-base'

interface Props {
  portal: Portal
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Shared frame for every login, sign-up and password page, labelled by portal. */
export function AuthShell({ portal, title, subtitle, children, footer }: Props) {
  return (
    <Center mih="100vh" bg="gray.0" p="md">
      <Box w="100%" maw={420}>
        <Group justify="space-between" mb="md">
          <Anchor component={Link} to={portal === 'staff' ? staffPath('/login') : '/login'} fw={800} c="dark" underline="never">
            {config.appName}
          </Anchor>
          <Badge variant="light" color={portal === 'staff' ? 'dark' : 'violet'}>
            {portal === 'staff' ? 'Staff console' : 'Customer site'}
          </Badge>
        </Group>
        <Paper withBorder shadow="sm" p="xl" radius="lg">
          <Stack gap="lg">
            <div>
              <Title order={2}>{title}</Title>
              {subtitle && (
                <Text c="dimmed" size="sm" mt={4}>
                  {subtitle}
                </Text>
              )}
            </div>
            {children}
          </Stack>
        </Paper>
        {footer && (
          <Text ta="center" size="sm" mt="md">
            {footer}
          </Text>
        )}
      </Box>
    </Center>
  )
}
