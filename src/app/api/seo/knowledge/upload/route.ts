import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic()

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const category = (formData.get('category') as string) || 'other'
  const title = (formData.get('title') as string) || ''

  if (!file) return err('ファイルが添付されていません', 400)
  if (file.type !== 'application/pdf') return err('PDF ファイルのみ対応しています', 400)
  if (file.size > 10 * 1024 * 1024) return err('ファイルサイズは 10MB 以下にしてください', 400)

  const arrayBuffer = await file.arrayBuffer()
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

  const content = response.content[0].type === 'text' ? response.content[0].text : ''
  if (!content) return err('PDF からテキストを抽出できませんでした', 400)

  const finalTitle = title || file.name.replace(/\.pdf$/i, '')

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
