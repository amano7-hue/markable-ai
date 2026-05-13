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
    // プロジェクト別に GA4 接続を取得して同期
    const connections = await step.run('fetch-connections', () =>
      prisma.ga4Connection.findMany({
        where: { propertyId: { not: '' }, projectId: { not: null } },
        select: { tenantId: true, projectId: true },
      })
    )

    logger.info(`GA4 sync: ${connections.length} project connections`)

    const results = await Promise.all(
      connections.map(({ tenantId, projectId }) =>
        step.run(`sync-ga4-${tenantId}-${projectId}`, async () => {
          if (!projectId) return { tenantId, projectId, synced: 0 }
          const synced = await syncGa4Data(tenantId, projectId)
          return { tenantId, projectId, synced }
        })
      )
    )

    return { connections: results.length }
  }
)
