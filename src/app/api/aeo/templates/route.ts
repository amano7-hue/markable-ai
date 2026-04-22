import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getTemplates } from '@/modules/aeo'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const industry = url.searchParams.get('industry') ?? undefined
  return ok(getTemplates(industry))
}
