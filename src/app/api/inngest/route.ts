import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncLlmoDaily, syncLlmoOnDemand, syncGscDaily, syncHubSpotDaily, syncGa4Daily, processKnowledgePdf, generateArticleImages, generateArticleDraftJob, analyzeArticleStructureJob } from '@/workers'

// 記事ドラフト生成は 3〜5 分かかるため Vercel の最大タイムアウトを設定する
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncLlmoDaily, syncLlmoOnDemand, syncGscDaily, syncHubSpotDaily, syncGa4Daily, processKnowledgePdf, generateArticleImages, generateArticleDraftJob, analyzeArticleStructureJob],
})
