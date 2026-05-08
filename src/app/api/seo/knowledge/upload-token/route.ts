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
        // auth チェックはトークン生成時に行う
        const ctx = await getAuth()
        if (!ctx) throw new Error('Unauthorized')
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 30 * 1024 * 1024,
          validUntil: Date.now() + 15 * 60 * 1000, // 15分
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
