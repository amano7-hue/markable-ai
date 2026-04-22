import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { detectCitationGaps } from '@/modules/aeo'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const gaps = await detectCitationGaps(ctx.tenant.id, ctx.tenant.ownDomain)
  return ok(gaps)
}
