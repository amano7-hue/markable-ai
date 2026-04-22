import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getTopOpportunities } from '@/modules/seo'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const opportunities = await getTopOpportunities(ctx.tenant.id)
  return ok(opportunities)
}
