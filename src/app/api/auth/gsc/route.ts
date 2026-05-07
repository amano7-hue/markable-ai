import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { getGscAuthUrl } from '@/integrations/gsc'
import { err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  // projectId を URL パラメータから取得、なければデフォルトプロジェクト
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
  const authUrl = getGscAuthUrl(state)
  redirect(authUrl)
}
