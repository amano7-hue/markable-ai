import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { syncDailySnapshots } from '@/modules/aeo'
import { getSerankingClient } from '@/integrations/seranking'

export async function POST() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  try {
    const client = getSerankingClient()
    await syncDailySnapshots(
      ctx.tenant.id,
      ctx.tenant.ownDomain,
      client,
      new Date(),
    )
    return ok({ synced: true }, 202)
  } catch (e) {
    console.error('[aeo/sync] syncDailySnapshots failed:', e)
    return err('AEO 同期に失敗しました', 500)
  }
}
