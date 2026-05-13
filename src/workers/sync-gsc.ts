import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { syncGscData } from '@/modules/seo'

export const syncGscDaily = inngest.createFunction(
  {
    id: 'sync-gsc-daily',
    name: 'GSC 日次データ同期',
    triggers: [{ cron: 'TZ=Asia/Tokyo 0 3 * * *' }],
  },
  async ({ step, logger }) => {
    // プロジェクト別 GSC 接続を取得
    const connections = await step.run('fetch-connections', () =>
      prisma.gscConnection.findMany({
        where: { projectId: { not: null } },
        select: { tenantId: true, projectId: true },
      })
    )

    logger.info(`GSC sync: ${connections.length} project connections`)

    const results = await Promise.all(
      connections.map(({ tenantId, projectId }) =>
        step.run(`sync-gsc-${tenantId}-${projectId}`, async () => {
          if (!projectId) return { tenantId, projectId, synced: 0 }
          const synced = await syncGscData(tenantId, projectId, 30)
          return { tenantId, projectId, synced }
        })
      )
    )

    return { connections: results.length }
  }
)
