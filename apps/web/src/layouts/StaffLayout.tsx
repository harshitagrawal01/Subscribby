import { AppShell, Burger, Group, NavLink, ScrollArea, Stack, Text } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { NavLink as RouterNavLink, Outlet } from 'react-router'
import { Logo } from '@/components/Logo'
import { staffPath } from '@/features/auth/staff-base'
import { useAuth } from '@/features/auth/useAuth'
import { STAFF_NAV } from './staff-nav'
import { UserMenu } from './UserMenu'

export function StaffLayout() {
  const { user } = useAuth()
  const [opened, { toggle, close }] = useDisclosure()
  const role = user?.role
  const isMobile = useMediaQuery('(max-width: 48em)') ?? false

  return (
    <AppShell
      header={{ height: 52, collapsed: !isMobile }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={0}
    >
      {/* Top bar only on small screens, where the sidebar is hidden behind the menu button. */}
      <AppShell.Header withBorder>
        <Group h="100%" px="md" gap="sm">
          <Burger opened={opened} onClick={toggle} size="sm" aria-label="Open navigation" />
          <Logo size="sm" tag="staff" />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar bg="#fff" style={{ borderRight: '1px solid var(--mantine-color-default-border)' }}>
        <AppShell.Section px={18} pt={20} pb={16} visibleFrom="sm">
          <Logo size="sm" tag="staff" />
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} px={10}>
          <Stack gap={18} py={6}>
            {STAFF_NAV.map(({ group, items }) => {
              const visible = items.filter((item) => role && item.roles.includes(role))
              if (!visible.length) return null
              return (
                <div key={group}>
                  <Text size="xs" c="dimmed" fw={500} px={10} mb={4}>
                    {group}
                  </Text>
                  {visible.map((item) => (
                    <NavLink
                      key={item.to}
                      component={RouterNavLink}
                      to={staffPath(item.to)}
                      label={item.label}
                      leftSection={<item.icon size={17} stroke={1.5} />}
                      onClick={close}
                      className="side-link"
                    />
                  ))}
                </div>
              )
            })}
          </Stack>
        </AppShell.Section>

        <AppShell.Section p={8} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <UserMenu profilePath={staffPath('/profile')} block />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="page">
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  )
}
