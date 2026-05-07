import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getAuth } from '@/lib/auth/get-auth'

export const maxDuration = 30

export async function POST(request: Request): Promise<Response> {
  const ctx = await getAuth()
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 30 * 1024 * 1024, // 30MB
        }
      },
      onUploadCompleted: async () => {
        // 後続の /api/seo/knowledge/upload で処理するため何もしない
      },
    })
    return Response.json(jsonResponse)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 })
  }
}
