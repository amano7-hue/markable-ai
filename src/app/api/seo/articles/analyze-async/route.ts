import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { inngest } from '@/lib/inngest/client'
import { AnalyzeArticleSchema } from '@/modules/seo'
import { z } from 'zod'

const Schema = AnalyzeArticleSchema.extend({
  projectId: z.string().optional(),
  // 後のgenerate時に使えるよう入力オプションも保存
  ownInsights: z.string().max(5000).optional(),
  relatedKeywords: z.string().max(500).optional(),
  avoidSensationalHeadings: z.boolean().optional(),
  trustedSourcesOnly: z.boolean().optional(),
})

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  const { keyword, title, projectId, ...rest } = parsed.data

  // プロジェクト特定
  let resolvedProjectId: string | null = null
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: ctx.tenant.id },
      select: { id: true },
    })
    resolvedProjectId = project?.id ?? null
  } else {
    const project = await prisma.project.findFirst({
      where: { tenantId: ctx.tenant.id },
      select: { id: true },
    })
    resolvedProjectId = project?.id ?? null
  }

  // 記事レコードを先に作成（draftStage='ANALYZING'）
  const article = await prisma.seoArticle.create({
    data: {
      tenantId: ctx.tenant.id,
      projectId: resolvedProjectId,
      title,
      brief: `分析中... キーワード: ${keyword}`,
      draft: null,
      draftStage: 'ANALYZING',
      // 入力パラメータを analysis フィールドに保存（review時に使用）
      analysis: { stage: 'ANALYZING', keyword, title, projectId: resolvedProjectId, ...rest },
    },
  })

  // Inngest ジョブをキュー
  await inngest.send({
    name: 'seo/article.analyze.requested',
    data: { tenantId: ctx.tenant.id, articleId: article.id, keyword, title },
  })

  return ok({ articleId: article.id }, 202)
}
