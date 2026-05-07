import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { syncDailySnapshots } from '@/modules/llmo'

export const maxDuration = 300

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  try {
    await syncDailySnapshots(ctx.tenant.id, ctx.project.ownDomain, new Date(), undefined, projectId)
    return ok({ synced: true })
  } catch (e) {
    console.error('[llmo/sync] failed:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return err(`同期に失敗しました: ${msg}`, 500)
  }
}
