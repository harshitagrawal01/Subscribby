import { createBrowserRouter, Navigate } from 'react-router'
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
import { PortalInvoiceDetailPage } from '@/pages/portal/PortalInvoiceDetailPage'
import { PortalInvoicesPage } from '@/pages/portal/PortalInvoicesPage'
import { PortalProfilePage } from '@/pages/portal/PortalProfilePage'
import { PortalSubscriptionDetailPage } from '@/pages/portal/PortalSubscriptionDetailPage'
import { PortalSubscriptionsPage } from '@/pages/portal/PortalSubscriptionsPage'
import { CustomerDetailPage } from '@/pages/staff/CustomerDetailPage'
import { CustomersPage } from '@/pages/staff/CustomersPage'
import { DashboardPage } from '@/pages/staff/DashboardPage'
import { DiscountsPage } from '@/pages/staff/DiscountsPage'
import { InvoiceDetailPage } from '@/pages/staff/InvoiceDetailPage'
import { InvoicesPage } from '@/pages/staff/InvoicesPage'
import { PaymentsPage } from '@/pages/staff/PaymentsPage'
import { PlansPage } from '@/pages/staff/PlansPage'
import { ProductsPage } from '@/pages/staff/ProductsPage'
import { StaffProfilePage } from '@/pages/staff/StaffProfilePage'
import { SubscriptionDetailPage } from '@/pages/staff/SubscriptionDetailPage'
import { SubscriptionNewPage } from '@/pages/staff/SubscriptionNewPage'
import { SubscriptionsPage } from '@/pages/staff/SubscriptionsPage'
import { TaxesPage } from '@/pages/staff/TaxesPage'
import { TemplatesPage } from '@/pages/staff/TemplatesPage'
import { UserImportPage } from '@/pages/staff/UserImportPage'
import { UsersPage } from '@/pages/staff/UsersPage'

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
          { path: 'subscriptions', element: <PortalSubscriptionsPage /> },
          { path: 'subscriptions/:id', element: <PortalSubscriptionDetailPage /> },
          { path: 'invoices', element: <PortalInvoicesPage /> },
          { path: 'invoices/:id', element: <PortalInvoiceDetailPage /> },
          { path: 'profile', element: <PortalProfilePage /> },
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
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'subscriptions', element: <SubscriptionsPage /> },
              { path: 'subscriptions/:id', element: <SubscriptionDetailPage /> },
              { path: 'invoices', element: <InvoicesPage /> },
              { path: 'invoices/:id', element: <InvoiceDetailPage /> },
              { path: 'payments', element: <PaymentsPage /> },
              { path: 'customers', element: <CustomersPage /> },
              { path: 'customers/:id', element: <CustomerDetailPage /> },
              { path: 'products', element: <ProductsPage /> },
              { path: 'plans', element: <PlansPage /> },
              { path: 'templates', element: <TemplatesPage /> },
              { path: 'profile', element: <StaffProfilePage /> },
              {
                element: <RequireRole roles={['admin', 'staff']} />,
                children: [{ path: 'subscriptions/new', element: <SubscriptionNewPage /> }],
              },
              {
                element: <RequireRole roles={['admin']} />,
                children: [
                  { path: 'taxes', element: <TaxesPage /> },
                  { path: 'discounts', element: <DiscountsPage /> },
                  { path: 'users', element: <UsersPage /> },
                  { path: 'users/import', element: <UserImportPage /> },
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
