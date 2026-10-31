import { Avatar, Group, Menu, Text, UnstyledButton } from '@mantine/core'
import { IconLogout, IconSelector, IconUserCircle } from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { ROLE_LABELS } from '@/lib/labels'

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

/** Name, role and account actions. `block` fills the sidebar footer; otherwise it's a compact top-bar button. */
export function UserMenu({ profilePath, block = false }: { profilePath: string; block?: boolean }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  return (
    <Menu position={block ? 'top-start' : 'bottom-end'} width={block ? 'target' : 220} offset={6}>
      <Menu.Target>
        <UnstyledButton
          aria-label="Account menu"
          style={{ width: block ? '100%' : undefined, padding: block ? '8px 10px' : 4, borderRadius: 4 }}
          className="user-menu-button"
        >
          <Group gap={10} wrap="nowrap">
            <Avatar color="ink" radius="xl" size={30} variant="filled">
              {initialsOf(user.name)}
            </Avatar>
            <div style={{ lineHeight: 1.2, minWidth: 0, flex: 1 }}>
              <Text size="sm" fw={500} truncate>
                {user.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {block ? ROLE_LABELS[user.role] : user.email}
              </Text>
            </div>
            <IconSelector size={14} stroke={1.5} color="var(--mantine-color-dimmed)" />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{user.email}</Menu.Label>
        <Menu.Item leftSection={<IconUserCircle size={16} stroke={1.5} />} onClick={() => navigate(profilePath)}>
          Profile and password
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconLogout size={16} stroke={1.5} />} onClick={logout}>
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
