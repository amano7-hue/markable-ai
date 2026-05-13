import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
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

// POST: Vercel Blob client-side upload のトークンを直接発行する
// handleUpload を使わず generateClientTokenFromReadWriteToken を直接呼ぶことで
// callback URL の pre-check エラーを回避する
export async function POST(request: Request): Promise<Response> {
  const ctx = await getAuth()
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { type?: string; payload?: { pathname?: string; multipart?: boolean } } = {}
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[upload-token] POST body.type:', body.type)

  if (body.type !== 'blob.generate-client-token') {
    return Response.json({ error: 'Unexpected event type' }, { status: 400 })
  }

  const pathname = body.payload?.pathname ?? 'upload.pdf'
  // multipart フラグをトークンに含める (handleUpload はこれを渡さないのが不具合の原因)
  const multipart = body.payload?.multipart ?? false

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      pathname,
      allowedContentTypes: ['application/pdf'],
      maximumSizeInBytes: 30 * 1024 * 1024,
      validUntil: Date.now() + 15 * 60 * 1000,
      // multipart: true をトークンペイロードに含めることで /mpu エンドポイントの認証を通す
      ...(multipart ? { multipart: true } : {}),
    })

    console.log('[upload-token] clientToken generated for pathname:', pathname)
    return Response.json({ type: 'blob.generate-client-token', clientToken })
  } catch (e) {
    const msg = (e as Error).message
    console.error('[upload-token] generateClientTokenFromReadWriteToken error:', msg)
    return Response.json({ error: msg }, { status: 400 })
  }
}
