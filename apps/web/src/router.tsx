import { createBrowserRouter, Navigate } from 'react-router'
import type { ComponentType } from 'react'

/** Each screen loads on first visit, so customers never download the staff console. */
const page = (load: () => Promise<Record<string, unknown>>, name: string) => ({
  lazy: async () => ({ Component: (await load())[name] as ComponentType }),
})

import { GuestOnly, RequireAuth, RequireRole } from '@/features/auth/guards'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { SetPasswordPage } from '@/features/auth/pages/SetPasswordPage'
import { SignupPage } from '@/features/auth/pages/SignupPage'
import { StaffGate } from '@/features/auth/StaffGate'
import { PortalLayout } from '@/layouts/PortalLayout'
import { StaffLayout } from '@/layouts/StaffLayout'
import { NotFoundPage } from '@/pages/ErrorPages'

/**
 * Two portals on one account system (spec section 5):
 *   Customer site  /login, /signup, /forgot-password, /reset-password, /portal/*
 *   Staff console  /<secret>/login, /<secret>/forgot-password, /<secret>/reset-password, /<secret>/*
 *                  (<secret> is random and never appears in the bundle; see features/auth/staff-base.ts)
 */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },

  // ----- Customer site -----
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage portal="customer" /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage portal="customer" /> },
    ],
  },
  { path: '/reset-password', element: <ResetPasswordPage portal="customer" /> },
  {
    element: <RequireAuth portal="customer" />,
    children: [
      { path: '/set-password', element: <SetPasswordPage portal="customer" /> },
      {
        path: '/portal',
        element: <PortalLayout />,
        children: [
          { index: true, element: <Navigate to="subscriptions" replace /> },
          { path: 'subscriptions', ...page(() => import('@/pages/portal/PortalSubscriptionsPage'), 'PortalSubscriptionsPage') },
          { path: 'subscriptions/:id', ...page(() => import('@/pages/portal/PortalSubscriptionDetailPage'), 'PortalSubscriptionDetailPage') },
          { path: 'invoices', ...page(() => import('@/pages/portal/PortalInvoicesPage'), 'PortalInvoicesPage') },
          { path: 'invoices/:id', ...page(() => import('@/pages/portal/PortalInvoiceDetailPage'), 'PortalInvoiceDetailPage') },
          { path: 'profile', ...page(() => import('@/pages/portal/PortalProfilePage'), 'PortalProfilePage') },
        ],
      },
    ],
  },

  // ----- Staff console (no sign-up), under a secret path segment -----
  // "/:staffSegment" only opens for the real secret (checked by hash in StaffGate).
  // Static routes above always win, and every other segment gets the same 404 as "*".
  {
    path: '/:staffSegment',
    element: <StaffGate />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: 'login', element: <LoginPage portal="staff" /> },
          { path: 'forgot-password', element: <ForgotPasswordPage portal="staff" /> },
        ],
      },
      { path: 'reset-password', element: <ResetPasswordPage portal="staff" /> },
      {
        element: <RequireAuth portal="staff" />,
        children: [
          { path: 'set-password', element: <SetPasswordPage portal="staff" /> },
          {
            element: <StaffLayout />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', ...page(() => import('@/pages/staff/DashboardPage'), 'DashboardPage') },
              { path: 'subscriptions', ...page(() => import('@/pages/staff/SubscriptionsPage'), 'SubscriptionsPage') },
              { path: 'subscriptions/:id', ...page(() => import('@/pages/staff/SubscriptionDetailPage'), 'SubscriptionDetailPage') },
              { path: 'invoices', ...page(() => import('@/pages/staff/InvoicesPage'), 'InvoicesPage') },
              { path: 'invoices/:id', ...page(() => import('@/pages/staff/InvoiceDetailPage'), 'InvoiceDetailPage') },
              { path: 'payments', ...page(() => import('@/pages/staff/PaymentsPage'), 'PaymentsPage') },
              { path: 'customers', ...page(() => import('@/pages/staff/CustomersPage'), 'CustomersPage') },
              { path: 'customers/:id', ...page(() => import('@/pages/staff/CustomerDetailPage'), 'CustomerDetailPage') },
              { path: 'products', ...page(() => import('@/pages/staff/ProductsPage'), 'ProductsPage') },
              { path: 'plans', ...page(() => import('@/pages/staff/PlansPage'), 'PlansPage') },
              { path: 'templates', ...page(() => import('@/pages/staff/TemplatesPage'), 'TemplatesPage') },
              { path: 'profile', ...page(() => import('@/pages/staff/StaffProfilePage'), 'StaffProfilePage') },
              {
                element: <RequireRole roles={['admin', 'staff']} />,
                children: [{ path: 'subscriptions/new', ...page(() => import('@/pages/staff/SubscriptionNewPage'), 'SubscriptionNewPage') }],
              },
              {
                element: <RequireRole roles={['admin']} />,
                children: [
                  { path: 'taxes', ...page(() => import('@/pages/staff/TaxesPage'), 'TaxesPage') },
                  { path: 'discounts', ...page(() => import('@/pages/staff/DiscountsPage'), 'DiscountsPage') },
                  { path: 'users', ...page(() => import('@/pages/staff/UsersPage'), 'UsersPage') },
                  { path: 'users/import', ...page(() => import('@/pages/staff/UserImportPage'), 'UserImportPage') },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
