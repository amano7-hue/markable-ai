import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { getAuth } from '@/lib/auth/get-auth'

export const maxDuration = 10

export async function POST(request: Request): Promise<Response> {
  const ctx = await getAuth()
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { filename } = await request.json()

  const safeName = String(filename ?? 'upload.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100)
  const pathname = `knowledge/${ctx.tenant.id}/${Date.now()}-${safeName}`

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      pathname,
      allowedContentTypes: ['application/pdf'],
      maximumSizeInBytes: 30 * 1024 * 1024,
      validUntil: Date.now() + 15 * 60 * 1000, // 15分
    })
    return Response.json({ clientToken, pathname })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
