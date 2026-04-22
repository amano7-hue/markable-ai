import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getSnapshotsForPrompt } from '@/modules/aeo'

type Params = { params: Promise<{ promptId: string }> }

export async function GET(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { promptId } = await params
  const url = new URL(req.url)
  const days = Number(url.searchParams.get('days') ?? '30')

  const snapshots = await getSnapshotsForPrompt(ctx.tenant.id, promptId, days)
  return ok(snapshots)
}
