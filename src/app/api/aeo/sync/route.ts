import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { syncDailySnapshots } from '@/modules/aeo'
import { getSerankingClient } from '@/integrations/seranking'

export async function POST() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const client = getSerankingClient()
  await syncDailySnapshots(
    ctx.tenant.id,
    ctx.tenant.ownDomain,
    client,
    new Date(),
  )

  return ok({ synced: true }, 202)
}
