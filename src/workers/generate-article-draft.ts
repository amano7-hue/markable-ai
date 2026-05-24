import { inngest } from '@/lib/inngest/client'
import { generateArticleDraft } from '@/modules/seo/article-service'
import { prisma } from '@/lib/db/client'
import type { GenerateArticleInput } from '@/modules/seo/schemas'

export const generateArticleDraftJob = inngest.createFunction(
  {
    id: 'generate-article-draft',
    name: '記事ドラフト生成',
    triggers: [{ event: 'seo/article.draft.requested' }],
    timeouts: { finish: '10m' },
    retries: 0,
  },
  async ({ event }) => {
    const { tenantId, input } = event.data as { tenantId: string; input: GenerateArticleInput }
    try {
      const result = await generateArticleDraft(tenantId, input)
      return result
    } catch (err) {
      // ANALYZING 状態のまま残らないよう FAILED にマークする
      if (input.existingArticleId) {
        try {
          await prisma.seoArticle.update({
            where: { id: input.existingArticleId },
            data: { draftStage: 'FAILED' },
          })
        } catch {
          // ignore — best effort
        }
      }
      throw err
    }
  },
)
