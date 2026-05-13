import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'

export default async function KnowledgeRedirectPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  const project = await prisma.project.findFirst({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })

  if (!project) redirect('/dashboard')

  redirect(`/dashboard/p/${project.id}/seo/knowledge`)
}
