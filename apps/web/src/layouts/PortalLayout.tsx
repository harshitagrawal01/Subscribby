import { AppShell, Badge, Button, Container, Group, Text } from '@mantine/core'
import { NavLink as RouterNavLink, Outlet } from 'react-router'
import { config } from '@/config'
import { UserMenu } from './UserMenu'

const LINKS = [
  { label: 'My subscriptions', to: '/portal/subscriptions' },
  { label: 'My invoices', to: '/portal/invoices' },
]

export function PortalLayout() {
  return (
    <AppShell header={{ height: 56 }} padding="lg">
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Group gap="lg">
              <Group gap="xs">
                <Text fw={800}>{config.appName}</Text>
                <Badge variant="light" size="sm">
                  Customer portal
                </Badge>
              </Group>
              <Group gap={4} visibleFrom="xs">
                {LINKS.map((link) => (
                  <RouterNavLink key={link.to} to={link.to} style={{ textDecoration: 'none' }}>
                    {({ isActive }) => (
                      <Button variant={isActive ? 'light' : 'subtle'} color={isActive ? 'violet' : 'gray'} size="compact-sm">
                        {link.label}
                      </Button>
                    )}
                  </RouterNavLink>
                ))}
              </Group>
            </Group>
            <UserMenu profilePath="/portal/profile" />
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main bg="gray.0">
        <Container size="lg">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
