import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { syncGa4Data } from '@/modules/analytics'

export async function POST() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  try {
    const count = await syncGa4Data(ctx.tenant.id)
    return ok({ synced: count }, 202)
  } catch (e) {
    console.error('[ga4/sync] syncGa4Data failed:', e)
    return err('GA4 同期に失敗しました', 500)
  }
}
