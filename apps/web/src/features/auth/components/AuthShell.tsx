import { Anchor, Box, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/Logo'
import type { Portal } from '@/lib/api/types'
import { staffPath } from '../staff-base'
import { ReceiptStack } from './ReceiptStack'

interface Props {
  portal: Portal
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

const PAPER = '#F4EFE6'

/**
 * Customer pages: the form on a soft sheet, with a small stack of receipts beside it.
 * Staff console pages: just the sheet. It's an internal tool.
 */
export function AuthShell({ portal, title, subtitle, children, footer }: Props) {
  const isStaff = portal === 'staff'

  const sheet = (
    <Box className="auth-sheet" w="100%" maw={440}>
      <Stack gap={26}>
        <div>
          <Title order={1} fz={30} lh={1.15}>
            {title}
          </Title>
          {subtitle && (
            <Text c="dimmed" mt={8}>
              {subtitle}
            </Text>
          )}
        </div>
        {children}
        {footer && <Text size="sm">{footer}</Text>}
      </Stack>
    </Box>
  )

  const logo = (
    <Anchor component={Link} to={isStaff ? staffPath('/login') : '/login'} underline="never" w="fit-content">
      <Logo size="md" tag={isStaff ? 'staff' : undefined} />
    </Anchor>
  )

  if (isStaff) {
    return (
      <Box mih="100vh" bg={PAPER} px={20} py={{ base: 28, sm: 48 }}>
        <Stack align="center" gap={32} pt={{ base: 8, sm: '8vh' }}>
          {logo}
          {sheet}
        </Stack>
      </Box>
    )
  }

  return (
    <Box mih="100vh" bg={PAPER} px={{ base: 20, sm: 48 }} py={{ base: 28, sm: 40 }}>
      {logo}
      <div className="auth-layout">
        {sheet}
        <div className="auth-aside">
          <ReceiptStack />
        </div>
      </div>
    </Box>
  )
}
