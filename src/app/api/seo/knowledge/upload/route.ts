import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { inngest } from '@/lib/inngest/client'

export const maxDuration = 30

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

  const blobFilename = blobUrl.split('/').pop()?.split('?')[0] ?? ''
  const finalTitle = title || blobFilename.replace(/\.pdf$/i, '').replace(/^[\w-]+-/, '') || 'PDF ドキュメント'

  const project = await prisma.project.findFirst({
    where: { tenantId: ctx.tenant.id },
    select: { id: true },
  })

  // まず「処理中」で DB に登録して即座に返す
  const source = await prisma.knowledgeSource.create({
    data: {
      tenantId: ctx.tenant.id,
      projectId: project?.id ?? null,
      type: 'PDF',
      category: category as 'case_study' | 'service' | 'company' | 'other',
      title: finalTitle,
      content: '',        // Inngest が後で埋める
      status: 'processing',
    },
  })

  // バックグラウンドでテキスト抽出を実行
  await inngest.send({
    name: 'knowledge/pdf.process',
    data: { knowledgeSourceId: source.id, blobUrl },
  })

  return ok({ id: source.id, title: finalTitle, processing: true })
}
