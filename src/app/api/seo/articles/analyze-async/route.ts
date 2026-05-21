import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { inngest } from '@/lib/inngest/client'
import { AnalyzeArticleSchema } from '@/modules/seo'
import { z } from 'zod'

const Schema = AnalyzeArticleSchema.extend({
  projectId: z.string().optional(),
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

  const { keyword, title, projectId, ownInsights, relatedKeywords, avoidSensationalHeadings, trustedSourcesOnly } = parsed.data

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

  // 記事レコードを先行作成（draftStage='ANALYZING'）
  const article = await prisma.seoArticle.create({
    data: {
      tenantId: ctx.tenant.id,
      projectId: resolvedProjectId,
      title,
      brief: `生成中... キーワード: ${keyword}`,
      draft: null,
      draftStage: 'ANALYZING',
    },
  })

  // 分析→生成を1つのジョブで実行（generateArticleDraftJobが内部でanalyzeArticleも呼ぶ）
  await inngest.send({
    name: 'seo/article.draft.requested',
    data: {
      tenantId: ctx.tenant.id,
      input: {
        keywordText: keyword,
        title,
        projectId: resolvedProjectId ?? undefined,
        ownInsights: ownInsights || undefined,
        relatedKeywords: relatedKeywords || undefined,
        avoidSensationalHeadings: avoidSensationalHeadings || undefined,
        trustedSourcesOnly: trustedSourcesOnly || undefined,
        existingArticleId: article.id,
      },
    },
  })

  return ok({ articleId: article.id }, 202)
}
