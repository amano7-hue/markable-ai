import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import Anthropic from '@anthropic-ai/sdk'
import { del } from '@vercel/blob'

export const maxDuration = 120

const client = new Anthropic()

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  if (!body || !body.blobUrl) return err('blobUrl が必要です', 400)

  const { blobUrl, category = 'other', title = '' } = body as {
    blobUrl: string
    category?: string
    title?: string
  }

  // Vercel Blob から PDF をダウンロード
  const pdfRes = await fetch(blobUrl)
  if (!pdfRes.ok) return err('PDF のダウンロードに失敗しました', 400)

  const arrayBuffer = await pdfRes.arrayBuffer()
  if (arrayBuffer.byteLength > 30 * 1024 * 1024) {
    await del(blobUrl).catch(() => {})
    return err('ファイルサイズは 30MB 以下にしてください', 400)
  }
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  // Anthropic API で PDF テキストを抽出
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'このPDFの内容を全文テキストとして出力してください。表・箇条書きは可能な限り構造を保持してください。説明文は不要です。',
          },
        ],
      },
    ],
  })

  // Blob を削除（一時ストレージとして利用）
  await del(blobUrl).catch(() => {})

  const content = response.content[0].type === 'text' ? response.content[0].text : ''
  if (!content) return err('PDF からテキストを抽出できませんでした', 400)

  // タイトルはリクエストから（Blob のパスから filename を復元）
  const blobFilename = blobUrl.split('/').pop()?.split('?')[0] ?? ''
  const finalTitle = title || blobFilename.replace(/\.pdf$/i, '').replace(/^[\w-]+-/, '') || 'PDF ドキュメント'

  const project = await prisma.project.findFirst({
    where: { tenantId: ctx.tenant.id },
    select: { id: true },
  })

  const source = await prisma.knowledgeSource.create({
    data: {
      tenantId: ctx.tenant.id,
      projectId: project?.id ?? null,
      type: 'PDF',
      category: category as 'case_study' | 'service' | 'company' | 'other',
      title: finalTitle,
      content,
      status: 'ready',
    },
  })

  return ok({ id: source.id, title: finalTitle, contentLength: content.length })
}
