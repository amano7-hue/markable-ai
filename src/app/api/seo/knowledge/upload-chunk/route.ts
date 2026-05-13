import { getAuth } from '@/lib/auth/get-auth'
import { err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const ctx = await getAuth()
    if (!ctx) return err('Unauthorized', 401)

    const uploadId = req.headers.get('x-upload-id') ?? ''
    const chunkIndex = parseInt(req.headers.get('x-chunk-index') ?? '0', 10)
    const totalChunks = parseInt(req.headers.get('x-total-chunks') ?? '1', 10)
    const filename = (() => { try { return decodeURIComponent(req.headers.get('x-filename') ?? 'upload.pdf') } catch { return 'upload.pdf' } })()
    const category = req.headers.get('x-category') ?? 'other'
    const title = (() => { try { return decodeURIComponent(req.headers.get('x-title') ?? '') } catch { return '' } })()
    const headerProjectId = req.headers.get('x-project-id') ?? null

    if (!uploadId) return err('x-upload-id が必要です', 400)

    console.log(`[upload-chunk] chunk ${chunkIndex + 1}/${totalChunks} uploadId=${uploadId}`)

    const chunkData = await req.arrayBuffer()
    if (chunkData.byteLength === 0) return err('チャンクデータが空です', 400)

    await prisma.pdfUploadChunk.create({
      data: {
        tenantId: ctx.tenant.id,
        uploadId,
        chunkIndex,
        data: Buffer.from(chunkData),
      },
    })

    console.log(`[upload-chunk] saved ${chunkData.byteLength} bytes to DB`)

    // 最終チャンク以外はここで終了
    if (chunkIndex < totalChunks - 1) {
      return NextResponse.json({ chunkIndex, stored: true })
    }

    // 最終チャンク: チャンクを集めて PDF パース → 同期的に完了まで処理
    const finalTitle =
      title ||
      filename.replace(/\.pdf$/i, '').replace(/^[\w-]+-/, '') ||
      'PDF ドキュメント'

    const resolvedProjectId = headerProjectId ?? (await prisma.project.findFirst({
      where: { tenantId: ctx.tenant.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    }))?.id ?? null

    const source = await prisma.knowledgeSource.create({
      data: {
        tenantId: ctx.tenant.id,
        projectId: resolvedProjectId,
        type: 'PDF',
        category: category as 'case_study' | 'service' | 'company' | 'other',
        title: finalTitle,
        content: '',
        status: 'processing',
      },
    })

    console.log(`[upload-chunk] created source=${source.id}, fetching chunks...`)

    let extractedText = ''
    let status: 'ready' | 'failed' = 'failed'
    let errorMsg = ''

    try {
      const chunks = await prisma.pdfUploadChunk.findMany({
        where: { uploadId, tenantId: ctx.tenant.id },
        orderBy: { chunkIndex: 'asc' },
        select: { data: true },
      })

      console.log(`[upload-chunk] fetched ${chunks.length}/${totalChunks} chunks`)

      if (chunks.length !== totalChunks) {
        throw new Error(`チャンク数不一致: 期待=${totalChunks} 実際=${chunks.length}`)
      }

      const pdfBuffer = Buffer.concat(chunks.map((c) => c.data))

      await prisma.pdfUploadChunk
        .deleteMany({ where: { uploadId, tenantId: ctx.tenant.id } })
        .catch(() => {})

      console.log(`[upload-chunk] parsing PDF (${pdfBuffer.length} bytes)...`)
      const result = await pdfParse(pdfBuffer)
      extractedText = result.text?.trim() ?? ''
      status = extractedText ? 'ready' : 'failed'
      console.log(`[upload-chunk] parse done, text=${extractedText.length} chars`)
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e)
      console.error(`[upload-chunk] extract error:`, errorMsg)
      status = 'failed'
    }

    await prisma.knowledgeSource.update({
      where: { id: source.id, tenantId: ctx.tenant.id },
      data: {
        content: status === 'failed' && errorMsg ? `ERROR: ${errorMsg}` : extractedText,
        status,
      },
    })

    console.log(`[upload-chunk] done, source=${source.id} status=${status}`)
    return NextResponse.json({ id: source.id, title: finalTitle, processing: false, status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[upload-chunk] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
