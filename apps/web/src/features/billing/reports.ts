import { http } from '@/lib/api/client'
import type { ApiResponse, Id, PlanBreakdown } from '@/lib/api/types'

/**
 * GET /reports/subscriptions-by-plan takes the shared report filters (planId, customerId),
 * which the typed reportsApi.subscriptionsByPlan doesn't expose yet.
 */
export const subscriptionsByPlan = (filters: { planId?: Id; customerId?: Id }) =>
  http.get<ApiResponse<PlanBreakdown[]>>('/reports/subscriptions-by-plan', filters).then((r) => r.data)
