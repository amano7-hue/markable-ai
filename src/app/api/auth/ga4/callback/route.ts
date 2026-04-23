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

    // propertyId は state2 パラメータかセッションから取得するが、
    // v1 ではコールバック後に UI で入力させるため空文字で保存し、後から更新する
    await prisma.ga4Connection.upsert({
      where: { tenantId: state },
      create: {
        tenantId: state,
        propertyId: '',
        email: tokens.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
      update: {
        email: tokens.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    })

    return NextResponse.redirect(
      new URL('/dashboard/analytics/connect?connected=1', process.env.NEXT_PUBLIC_APP_URL!),
    )
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard/analytics/connect?error=1', process.env.NEXT_PUBLIC_APP_URL!),
    )
  }
}
