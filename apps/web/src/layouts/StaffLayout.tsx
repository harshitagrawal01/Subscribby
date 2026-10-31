import { AppShell, Badge, Burger, Group, NavLink, ScrollArea, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { NavLink as RouterNavLink, Outlet } from 'react-router'
import { config } from '@/config'
import { staffPath } from '@/features/auth/staff-base'
import { useAuth } from '@/features/auth/useAuth'
import { STAFF_NAV } from './staff-nav'
import { UserMenu } from './UserMenu'

export function StaffLayout() {
  const { user } = useAuth()
  const [opened, { toggle, close }] = useDisclosure()
  const role = user?.role

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 232, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="lg">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={800}>{config.appName}</Text>
            <Badge variant="light" color="dark" size="sm">
              Staff console
            </Badge>
          </Group>
          <UserMenu profilePath={staffPath('/profile')} />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea>
          {STAFF_NAV.map(({ group, items }) => {
            const visible = items.filter((item) => role && item.roles.includes(role))
            if (!visible.length) return null
            return (
              <div key={group}>
                <Text size="xs" c="dimmed" fw={700} tt="uppercase" px="sm" mt="md" mb={4}>
                  {group}
                </Text>
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    component={RouterNavLink}
                    to={staffPath(item.to)}
                    label={item.label}
                    leftSection={<item.icon size={18} stroke={1.6} />}
                    onClick={close}
                    style={{ borderRadius: 8 }}
                  />
                ))}
              </div>
            )
          })}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
