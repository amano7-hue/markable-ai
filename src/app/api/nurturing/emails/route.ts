import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { listDrafts } from '@/modules/nurturing'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? undefined
  const drafts = await listDrafts(ctx.tenant.id, status)
  return ok(drafts)
}
