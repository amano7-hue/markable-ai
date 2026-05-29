/**
 * プライベート Vercel Blob をブラウザに配信するプロキシ
 * GET /api/private-blob?url=<encoded-blob-url>
 * GET /api/private-blob?url=<encoded-blob-url>&download=<filename>  → Content-Disposition: attachment
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { get as getBlob, BlobError } from '@vercel/blob'

export async function GET(req: NextRequest) {
  const ctx = await getAuth()
  if (!ctx) return new NextResponse('Unauthorized', { status: 401 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('url is required', { status: 400 })

  const downloadFilename = req.nextUrl.searchParams.get('download')

  // 自ストアの URL であることを確認
  try {
    const { hostname } = new URL(url)
    if (!hostname.endsWith('.blob.vercel-storage.com')) {
      return new NextResponse('Invalid URL', { status: 400 })
    }
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  try {
    const result = await getBlob(url, { access: 'private' })
    if (!result) {
      return new NextResponse('Not found', { status: 404 })
    }
    if (result.statusCode !== 200) {
      return new NextResponse('Not found', { status: 404 })
    }

    const contentType = result.blob.contentType ?? 'image/png'
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    }
    if (downloadFilename) {
      headers['Content-Disposition'] = `attachment; filename="${downloadFilename}"`
    }

    return new NextResponse(result.stream as unknown as ReadableStream, { headers })
  } catch (e) {
    if (e instanceof BlobError) {
      console.error('[private-blob] BlobError:', e.message)
      return new NextResponse('Blob fetch failed', { status: 502 })
    }
    throw e
  }
}
