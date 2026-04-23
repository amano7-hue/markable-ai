import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { syncGa4Data } from '@/modules/analytics'

export const syncGa4Daily = inngest.createFunction(
  {
    id: 'sync-ga4-daily',
    name: 'GA4 日次データ同期',
    triggers: [{ cron: 'TZ=Asia/Tokyo 0 5 * * *' }],
  },
  async ({ step, logger }) => {
    const tenantIds = await step.run('fetch-connections', () =>
      prisma.ga4Connection.findMany({
        where: { propertyId: { not: '' } },
        select: { tenantId: true },
      })
    )

    logger.info(`GA4 sync: ${tenantIds.length} connections`)

    const results = await Promise.all(
      tenantIds.map(({ tenantId }) =>
        step.run(`sync-ga4-${tenantId}`, async () => {
          const synced = await syncGa4Data(tenantId)
          return { tenantId, synced }
        })
      )
    )

    return { tenants: results.length }
  }
)
