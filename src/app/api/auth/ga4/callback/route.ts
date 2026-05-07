import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { exchangeCodeForTokens } from '@/integrations/ga4'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // tenantId
  const error = url.searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard/analytics/connect?error=1', process.env.NEXT_PUBLIC_APP_URL!),
    )
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    const project = await prisma.project.findFirst({
      where: { tenantId: state },
      select: { id: true },
    })

    const existing = project
      ? await prisma.ga4Connection.findUnique({ where: { projectId: project.id } })
      : null

    if (existing) {
      await prisma.ga4Connection.update({
        where: { id: existing.id },
        data: {
          email: tokens.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        },
      })
    } else {
      await prisma.ga4Connection.create({
        data: {
          tenantId: state,
          projectId: project?.id ?? null,
          propertyId: '',
          email: tokens.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        },
      })
    }

    return NextResponse.redirect(
      new URL('/dashboard/analytics/connect?connected=1', process.env.NEXT_PUBLIC_APP_URL!),
    )
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard/analytics/connect?error=1', process.env.NEXT_PUBLIC_APP_URL!),
    )
  }
}
