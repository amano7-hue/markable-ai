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
        select: { tenantId: true, apiKey: true, portalId: true },
      })
    )

    logger.info(`HubSpot sync: ${connections.length} connections`)

    const results = await Promise.all(
      connections.map((conn) =>
        step.run(`sync-hubspot-${conn.tenantId}`, async () => {
          const client = getHubSpotClient(conn)
          const count = await syncLeads(conn.tenantId, client)
          return { tenantId: conn.tenantId, synced: count }
        })
      )
    )

    const total = results.reduce((sum, r) => sum + r.synced, 0)
    return { tenants: results.length, totalLeads: total }
  }
)
