import {
  IconBox,
  IconCash,
  IconDiscount,
  IconFileInvoice,
  IconLayoutDashboard,
  IconReceiptTax,
  IconRepeat,
  IconTemplate,
  IconUserCircle,
  IconUsers,
  IconUsersGroup,
  IconCalendarRepeat,
  type Icon,
} from '@tabler/icons-react'
import type { Role } from '@/lib/api/types'

export interface NavItem {
  label: string
  /** Path inside the console, e.g. '/invoices'. Turned into a full URL with staffPath(). */
  to: string
  icon: Icon
  roles: Role[]
}

const ALL_STAFF: Role[] = ['admin', 'staff', 'finance']

/** Sidebar for the staff console. Roles match the spec's permission matrix (section 3). */
export const STAFF_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Main',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: IconLayoutDashboard, roles: ALL_STAFF },
      { label: 'Subscriptions', to: '/subscriptions', icon: IconRepeat, roles: ALL_STAFF },
      { label: 'Invoices', to: '/invoices', icon: IconFileInvoice, roles: ALL_STAFF },
      { label: 'Payments', to: '/payments', icon: IconCash, roles: ALL_STAFF },
      { label: 'Customers', to: '/customers', icon: IconUsersGroup, roles: ALL_STAFF },
    ],
  },
  {
    group: 'Catalog',
    items: [
      { label: 'Products', to: '/products', icon: IconBox, roles: ALL_STAFF },
      { label: 'Plans', to: '/plans', icon: IconCalendarRepeat, roles: ALL_STAFF },
      { label: 'Quote templates', to: '/templates', icon: IconTemplate, roles: ALL_STAFF },
    ],
  },
  {
    group: 'Admin',
    items: [
      { label: 'Taxes', to: '/taxes', icon: IconReceiptTax, roles: ['admin'] },
      { label: 'Discounts', to: '/discounts', icon: IconDiscount, roles: ['admin'] },
      { label: 'Users', to: '/users', icon: IconUsers, roles: ['admin'] },
    ],
  },
  {
    group: 'Account',
    items: [{ label: 'My profile', to: '/profile', icon: IconUserCircle, roles: ALL_STAFF }],
  },
]
