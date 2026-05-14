import { inngest } from '@/lib/inngest/client'
import { generateArticleDraft } from '@/modules/seo/article-service'
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
    const result = await generateArticleDraft(tenantId, input)
    return result
  },
)
