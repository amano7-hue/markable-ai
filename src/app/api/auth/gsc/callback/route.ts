import { redirect } from 'next/navigation'
import { exchangeCodeForTokens } from '@/integrations/gsc'
import { prisma } from '@/lib/db/client'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const tenantId = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error || !code || !tenantId) {
    redirect('/dashboard/seo/connect?error=oauth_failed')
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    // GSC プロパティ一覧を取得してデフォルトの siteUrl を決定
    const sitesRes = await fetch(
      'https://www.googleapis.com/webmasters/v3/sites',
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      },
    )
    const sitesData = (await sitesRes.json()) as {
      siteEntry?: Array<{ siteUrl: string }>
    }
    const siteUrl = sitesData.siteEntry?.[0]?.siteUrl ?? ''

    await prisma.gscConnection.upsert({
      where: { tenantId },
      create: {
        tenantId,
        email: tokens.email,
        siteUrl,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
      update: {
        email: tokens.email,
        siteUrl,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    })
  } catch {
    redirect('/dashboard/seo/connect?error=token_exchange_failed')
  }

  redirect('/dashboard/seo/connect?connected=true')
}
