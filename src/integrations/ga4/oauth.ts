const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']

export function getGa4AuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/ga4/callback`,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export interface TokenResult {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  email: string
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResult> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/ga4/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)

  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    id_token?: string
  }

  const email = data.id_token ? parseEmailFromIdToken(data.id_token) : ''

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    email,
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)

  const data = (await res.json()) as { access_token: string; expires_in: number }

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

function parseEmailFromIdToken(idToken: string): string {
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64url').toString(),
    ) as { email?: string }
    return payload.email ?? ''
  } catch {
    return ''
  }
}
