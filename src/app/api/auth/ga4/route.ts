import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { getGa4AuthUrl } from '@/integrations/ga4'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const url = getGa4AuthUrl(ctx.tenant.id)
  return Response.redirect(url)
}
