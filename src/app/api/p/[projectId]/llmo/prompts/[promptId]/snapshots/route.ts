import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getSnapshotsForPrompt } from '@/modules/llmo'

type Params = { params: Promise<{ projectId: string; promptId: string }> }

export async function GET(req: Request, { params }: Params) {
  const { projectId, promptId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const days = Number(url.searchParams.get('days') ?? '30')

  const snapshots = await getSnapshotsForPrompt(ctx.tenant.id, promptId, days, projectId)
  return ok(snapshots)
}
