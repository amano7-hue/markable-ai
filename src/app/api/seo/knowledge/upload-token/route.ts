import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getAuth } from '@/lib/auth/get-auth'

export const maxDuration = 30

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const ctx = await getAuth()
        if (!ctx) throw new Error('Unauthorized')
        // callbackUrl を明示指定しないと getCallbackUrl() が undefined を返し
        // Vercel Blob サーバーがトークンを "Token expired" で弾く
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ??
          (process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : null)
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 30 * 1024 * 1024,
          validUntil: Date.now() + 15 * 60 * 1000,
          ...(appUrl ? { callbackUrl: `${appUrl}/api/seo/knowledge/upload-token` } : {}),
        }
      },
      onUploadCompleted: async () => {
        // Inngest でバックグラウンド処理するため何もしない
      },
    })
    return Response.json(jsonResponse)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}
