/**
 * プライベート Vercel Blob をブラウザに配信するプロキシ
 * GET /api/private-blob?url=<encoded-blob-url>
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { get as getBlob } from '@vercel/blob'

export async function GET(req: NextRequest) {
  const ctx = await getAuth()
  if (!ctx) return new NextResponse('Unauthorized', { status: 401 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('url is required', { status: 400 })

  // 自ストアの URL であることを確認
  try {
    const { hostname } = new URL(url)
    if (!hostname.endsWith('.blob.vercel-storage.com')) {
      return new NextResponse('Invalid URL', { status: 400 })
    }
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  const result = await getBlob(url, { access: 'private' })
  if (!result || result.statusCode !== 200) {
    return new NextResponse('Not found', { status: 404 })
  }

  return new NextResponse(result.stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': result.blob.contentType ?? 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
