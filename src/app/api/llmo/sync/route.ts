import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { syncDailySnapshots } from '@/modules/llmo'

export const maxDuration = 300 // Vercel max timeout

export async function POST() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  try {
    await syncDailySnapshots(ctx.tenant.id, ctx.tenant.ownDomain, new Date())
    return ok({ synced: true })
  } catch (e) {
    console.error('[llmo/sync] failed:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return err(`同期に失敗しました: ${msg}`, 500)
  }
}
