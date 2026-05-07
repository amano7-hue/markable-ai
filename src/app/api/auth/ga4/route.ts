import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { getGa4AuthUrl } from '@/integrations/ga4'
import { prisma } from '@/lib/db/client'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const url = new URL(req.url)
  let projectId = url.searchParams.get('projectId')
  if (!projectId) {
    const project = await prisma.project.findFirst({
      where: { tenantId: ctx.tenant.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    projectId = project?.id ?? null
  }

  const state = JSON.stringify({ tenantId: ctx.tenant.id, projectId })
  return Response.redirect(getGa4AuthUrl(state))
}
