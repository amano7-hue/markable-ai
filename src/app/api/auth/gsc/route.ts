import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { getGscAuthUrl } from '@/integrations/gsc'
import { err } from '@/lib/api-response'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = getGscAuthUrl(ctx.tenant.id)
  redirect(url)
}
