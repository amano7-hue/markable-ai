import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { applySegmentCriteria } from '@/modules/nurturing'

type Params = { params: Promise<{ segmentId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { segmentId } = await params
  const count = await applySegmentCriteria(ctx.tenant.id, segmentId)
  return ok({ applied: count })
}
