import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { syncLeads } from '@/modules/nurturing'
import { getHubSpotClient } from '@/integrations/hubspot'

export const syncHubSpotDaily = inngest.createFunction(
  {
    id: 'sync-hubspot-daily',
    name: 'HubSpot 日次リード同期',
    triggers: [{ cron: 'TZ=Asia/Tokyo 0 4 * * *' }],
  },
  async ({ step, logger }) => {
    const connections = await step.run('fetch-connections', () =>
      prisma.hubSpotConnection.findMany({
        select: { tenantId: true, projectId: true, apiKey: true, portalId: true },
      })
    )

    logger.info(`HubSpot sync: ${connections.length} connections`)

    const results = await Promise.all(
      connections.map((conn) =>
        step.run(`sync-hubspot-${conn.projectId}`, async () => {
          const client = getHubSpotClient(conn)
          const count = await syncLeads(conn.tenantId, conn.projectId, client)
          return { projectId: conn.projectId, synced: count }
        })
      )
    )

    const total = results.reduce((sum, r) => sum + r.synced, 0)
    return { projects: results.length, totalLeads: total }
  }
)
