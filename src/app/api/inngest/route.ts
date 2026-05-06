import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncLlmoDaily, syncLlmoOnDemand, syncGscDaily, syncHubSpotDaily, syncGa4Daily } from '@/workers'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncLlmoDaily, syncLlmoOnDemand, syncGscDaily, syncHubSpotDaily, syncGa4Daily],
})
