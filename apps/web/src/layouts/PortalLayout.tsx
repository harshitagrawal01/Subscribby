import { AppShell, Container, Group } from '@mantine/core'
import { NavLink as RouterNavLink, Outlet } from 'react-router'
import { Logo } from '@/components/Logo'
import { UserMenu } from './UserMenu'

const LINKS = [
  { label: 'Subscriptions', to: '/portal/subscriptions' },
  { label: 'Invoices', to: '/portal/invoices' },
]

export function PortalLayout() {
  return (
    <AppShell header={{ height: 60 }} padding={0}>
      <AppShell.Header bg="#fff">
        <Container size={1040} h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap={36} h="100%" wrap="nowrap">
              <Logo size="sm" />
              <Group gap={24} h="100%" visibleFrom="xs" component="nav">
                {LINKS.map((link) => (
                  <RouterNavLink key={link.to} to={link.to} className="top-link">
                    {link.label}
                  </RouterNavLink>
                ))}
              </Group>
            </Group>
            <UserMenu profilePath="/portal/profile" />
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size={1040} py={32}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
