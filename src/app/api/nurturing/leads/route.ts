import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { listLeads } from '@/modules/nurturing'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const lifecycle = url.searchParams.get('lifecycle') ?? undefined
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)

  const result = await listLeads(ctx.tenant.id, lifecycle, page)
  return ok(result)
}
