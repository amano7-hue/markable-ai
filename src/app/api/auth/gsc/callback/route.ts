import { redirect } from 'next/navigation'
import { exchangeCodeForTokens } from '@/integrations/gsc'
import { prisma } from '@/lib/db/client'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error || !code || !stateRaw) {
    let pid: string | null = null
    try { pid = (JSON.parse(stateRaw ?? '') as { projectId?: string }).projectId ?? null } catch { /* ignore */ }
    const base = pid ? `/dashboard/p/${pid}/seo/connect` : '/dashboard/seo/connect'
    redirect(`${base}?error=oauth_failed`)
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

  // eslint-disable-next-line prefer-const
  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>> | null = null
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (e) {
    console.error('[gsc/callback] exchangeCodeForTokens failed:', e)
    const errBase = projectId ? `/dashboard/p/${projectId}/seo/connect` : '/dashboard/seo/connect'
    redirect(`${errBase}?error=token_exchange_failed`)
  }

  let siteUrl = ''
  try {
    const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${tokens!.accessToken}` },
    })
    if (!sitesRes.ok) {
      console.error('[gsc/callback] sites API error:', sitesRes.status, await sitesRes.text())
    } else {
      const sitesData = (await sitesRes.json()) as { siteEntry?: Array<{ siteUrl: string }> }
      siteUrl = sitesData.siteEntry?.[0]?.siteUrl ?? ''
    }
  } catch (e) {
    console.error('[gsc/callback] sites API fetch failed:', e)
    // サイト取得失敗は無視して続行
  }

  try {
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
        data: { email: tokens!.email, siteUrl, accessToken: tokens!.accessToken, refreshToken: tokens!.refreshToken, expiresAt: tokens!.expiresAt },
      })
    } else {
      await prisma.gscConnection.create({
        data: {
          tenantId,
          projectId,
          email: tokens!.email,
          siteUrl,
          accessToken: tokens!.accessToken,
          refreshToken: tokens!.refreshToken,
          expiresAt: tokens!.expiresAt,
        },
      })
    }
  } catch (e) {
    console.error('[gsc/callback] DB save failed:', e)
    const errBase = projectId ? `/dashboard/p/${projectId}/seo/connect` : '/dashboard/seo/connect'
    redirect(`${errBase}?error=token_exchange_failed`)
  }

  const successBase = projectId ? `/dashboard/p/${projectId}/seo/connect` : '/dashboard/seo/connect'
  redirect(`${successBase}?connected=true`)
}
