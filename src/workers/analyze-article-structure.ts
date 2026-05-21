import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { analyzeArticle } from '@/modules/seo/article-service'

export const analyzeArticleStructureJob = inngest.createFunction(
  {
    id: 'analyze-article-structure',
    name: '記事構成分析',
    triggers: [{ event: 'seo/article.analyze.requested' }],
    timeouts: { finish: '3m' },
    retries: 0,
  },
  async ({ event }) => {
    const { tenantId, articleId, keyword, title } = event.data as {
      tenantId: string
      articleId: string
      keyword: string
      title: string
    }

    try {
      const result = await analyzeArticle(keyword, title)

      await prisma.seoArticle.update({
        where: { id: articleId, tenantId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { draftStage: 'REVIEWING', analysis: result as any },
      })

      return { articleId, done: true }
    } catch (err) {
      // 分析失敗時は記事を削除してユーザーに通知できるよう FAILED ステージに
      await prisma.seoArticle.update({
        where: { id: articleId, tenantId },
        data: { draftStage: 'FAILED' },
      }).catch(() => null)
      throw err
    }
  },
)
