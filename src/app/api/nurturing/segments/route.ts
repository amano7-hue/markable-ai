import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { listSegments, createSegment, CreateSegmentSchema } from '@/modules/nurturing'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const segments = await listSegments(ctx.tenant.id)
  return ok(segments)
}

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = CreateSegmentSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const segment = await createSegment(ctx.tenant.id, parsed.data)
  return ok(segment, 201)
}
