import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncAeoDaily, syncGscDaily, syncHubSpotDaily } from '@/workers'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncAeoDaily, syncGscDaily, syncHubSpotDaily],
})
