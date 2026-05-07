import { redirect } from 'next/navigation'
import { exchangeCodeForTokens } from '@/integrations/gsc'
import { prisma } from '@/lib/db/client'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error || !code || !stateRaw) {
    redirect('/dashboard/seo/connect?error=oauth_failed')
  }

  // state は JSON ({tenantId, projectId}) または後方互換で tenantId 文字列
  let tenantId: string
  let projectId: string | null = null
  try {
    const parsed = JSON.parse(stateRaw) as { tenantId: string; projectId?: string | null }
    tenantId = parsed.tenantId
    projectId = parsed.projectId ?? null
  } catch {
    tenantId = stateRaw
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    const sitesData = (await sitesRes.json()) as { siteEntry?: Array<{ siteUrl: string }> }
    const siteUrl = sitesData.siteEntry?.[0]?.siteUrl ?? ''

    // projectId が指定されていない場合はデフォルトプロジェクトを使用
    if (!projectId) {
      const project = await prisma.project.findFirst({
        where: { tenantId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      })
      projectId = project?.id ?? null
    }

    const existing = projectId
      ? await prisma.gscConnection.findUnique({ where: { projectId } })
      : null

    if (existing) {
      await prisma.gscConnection.update({
        where: { id: existing.id },
        data: { email: tokens.email, siteUrl, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt },
      })
    } else {
      await prisma.gscConnection.create({
        data: {
          tenantId,
          projectId,
          email: tokens.email,
          siteUrl,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        },
      })
    }
  } catch {
    redirect('/dashboard/seo/connect?error=token_exchange_failed')
  }

  redirect('/dashboard/seo/connect?connected=true')
}
