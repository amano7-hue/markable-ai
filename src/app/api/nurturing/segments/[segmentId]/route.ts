import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getSegment, deleteSegment } from '@/modules/nurturing'

type Params = { params: Promise<{ segmentId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { segmentId } = await params
  const segment = await getSegment(ctx.tenant.id, segmentId)
  if (!segment) return err('Not found', 404)
  return ok(segment)
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { segmentId } = await params
  await deleteSegment(ctx.tenant.id, segmentId)
  return ok({ deleted: true })
}
