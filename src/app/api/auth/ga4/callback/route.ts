import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { exchangeCodeForTokens } from '@/integrations/ga4'

const appUrl = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error || !code || !stateRaw) {
    let pid: string | null = null
    try { pid = (JSON.parse(stateRaw ?? '') as { projectId?: string }).projectId ?? null } catch { /* ignore */ }
    const base = pid ? `/dashboard/p/${pid}/analytics/connect` : '/dashboard/analytics/connect'
    return NextResponse.redirect(new URL(`${base}?error=1`, appUrl))
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

    if (!projectId) {
      const project = await prisma.project.findFirst({
        where: { tenantId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      })
      projectId = project?.id ?? null
    }

    const existing = projectId
      ? await prisma.ga4Connection.findUnique({ where: { projectId } })
      : null

    if (existing) {
      await prisma.ga4Connection.update({
        where: { id: existing.id },
        data: { email: tokens.email, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt },
      })
    } else {
      await prisma.ga4Connection.create({
        data: {
          tenantId,
          projectId,
          propertyId: '',
          email: tokens.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        },
      })
    }

    const successBase = projectId ? `/dashboard/p/${projectId}/analytics/connect` : '/dashboard/analytics/connect'
    return NextResponse.redirect(new URL(`${successBase}?connected=1`, appUrl))
  } catch {
    const errBase = projectId ? `/dashboard/p/${projectId}/analytics/connect` : '/dashboard/analytics/connect'
    return NextResponse.redirect(new URL(`${errBase}?error=1`, appUrl))
  }
}
