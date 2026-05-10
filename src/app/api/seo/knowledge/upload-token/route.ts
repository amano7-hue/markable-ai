import { handleUpload, type HandleUploadBody, generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { getAuth } from '@/lib/auth/get-auth'

export const maxDuration = 30

export async function GET(): Promise<Response> {
  // 診断用: トークン設定と生成をテスト
  const rawToken = process.env.BLOB_READ_WRITE_TOKEN ?? ''
  const parts = rawToken.split('_')
  const storeId = parts[3] ?? null
  const tokenSet = !!rawToken
  const formatOk = parts.length >= 4 && parts[0] === 'vercel' && parts[1] === 'blob'

  let generateOk = false
  let generateError = ''
  try {
    await generateClientTokenFromReadWriteToken({
      token: rawToken,
      pathname: 'test/diagnostic.pdf',
      allowedContentTypes: ['application/pdf'],
      maximumSizeInBytes: 1024,
      validUntil: Date.now() + 60_000,
    })
    generateOk = true
  } catch (e) {
    generateError = (e as Error).message
  }

  return Response.json({
    tokenSet,
    formatOk,
    storeId: storeId ? `${storeId.slice(0, 8)}...` : null,
    generateOk,
    generateError,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    now: Date.now(),
  })
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody
  console.log('[upload-token] POST body.type:', body.type)
  console.log('[upload-token] BLOB_READ_WRITE_TOKEN set:', !!process.env.BLOB_READ_WRITE_TOKEN)

  try {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : null)
    console.log('[upload-token] callbackUrl base:', appUrl)

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const ctx = await getAuth()
        if (!ctx) throw new Error('Unauthorized')
        console.log('[upload-token] generating token for pathname:', pathname)
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 30 * 1024 * 1024,
          validUntil: Date.now() + 15 * 60 * 1000,
          ...(appUrl ? { callbackUrl: `${appUrl}/api/seo/knowledge/upload-token` } : {}),
        }
      },
      onUploadCompleted: async () => {
        console.log('[upload-token] upload completed webhook received')
      },
    })
    console.log('[upload-token] handleUpload success, type:', jsonResponse.type)
    return Response.json(jsonResponse)
  } catch (e) {
    const msg = (e as Error).message
    console.error('[upload-token] error:', msg)
    return Response.json({ error: msg }, { status: 400 })
  }
}
