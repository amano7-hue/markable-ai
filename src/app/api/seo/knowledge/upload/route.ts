import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import Anthropic from '@anthropic-ai/sdk'
import { del } from '@vercel/blob'

export const maxDuration = 300

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

  // Anthropic API に Blob URL を直接渡してテキスト抽出
  // （サーバーでのダウンロード・base64エンコード不要）
  let content = ''
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'url',
                url: blobUrl,
              },
            },
            {
              type: 'text',
              text: 'このPDFの内容を抽出してください。見出し・本文・表・箇条書きの構造を保持してください。ページ番号・フッター・ヘッダーは除外してください。説明文や前置きは不要で、抽出テキストのみ出力してください。',
            },
          ],
        },
      ],
    })
    content = response.content[0].type === 'text' ? response.content[0].text : ''
  } finally {
    // 処理完了後は Blob を削除（成功・失敗問わず）
    await del(blobUrl).catch(() => {})
  }

  if (!content) return err('PDF からテキストを抽出できませんでした', 400)

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
