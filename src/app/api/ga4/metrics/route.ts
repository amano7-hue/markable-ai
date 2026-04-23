import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { listDailyMetrics, getMetricsSummary } from '@/modules/analytics'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') ?? '30', 10)

  const [metrics, summary] = await Promise.all([
    listDailyMetrics(ctx.tenant.id, days),
    getMetricsSummary(ctx.tenant.id),
  ])

  return ok({ metrics, summary })
}
