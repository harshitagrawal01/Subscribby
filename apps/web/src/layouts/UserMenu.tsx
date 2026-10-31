import { Avatar, Group, Menu, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconLogout, IconUserCircle } from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { ROLE_LABELS } from '@/lib/labels'

export function UserMenu({ profilePath }: { profilePath: string }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Menu position="bottom-end" width={200}>
      <Menu.Target>
        <UnstyledButton>
          <Group gap="xs">
            <Avatar color="violet" radius="xl" size="sm">
              {initials}
            </Avatar>
            <div style={{ lineHeight: 1.1 }}>
              <Text size="sm" fw={600}>
                {user.name}
              </Text>
              <Text size="xs" c="dimmed">
                {ROLE_LABELS[user.role]}
              </Text>
            </div>
            <IconChevronDown size={14} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconUserCircle size={16} />} onClick={() => navigate(profilePath)}>
          My profile
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={logout}>
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
