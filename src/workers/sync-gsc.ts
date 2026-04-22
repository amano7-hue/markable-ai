import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { syncGscData } from '@/modules/seo'
import { getGscClient } from '@/integrations/gsc'

export const syncGscDaily = inngest.createFunction(
  {
    id: 'sync-gsc-daily',
    name: 'GSC 日次データ同期',
    triggers: [{ cron: 'TZ=Asia/Tokyo 0 3 * * *' }],
  },
  async ({ step, logger }) => {
    // tenantId だけ取得（Date 型を step.run の JSON シリアライズに渡さない）
    const tenantIds = await step.run('fetch-connections', () =>
      prisma.gscConnection.findMany({ select: { tenantId: true } })
    )

    logger.info(`GSC sync: ${tenantIds.length} connections`)

    const results = await Promise.all(
      tenantIds.map(({ tenantId }) =>
        step.run(`sync-gsc-${tenantId}`, async () => {
          // step 内で再取得することで Date 型を安全に扱う
          const conn = await prisma.gscConnection.findUnique({ where: { tenantId } })
          const client = await getGscClient(conn)
          const siteUrl = conn?.siteUrl ?? 'mock'
          await syncGscData(tenantId, siteUrl, client, 30)
          return { tenantId, ok: true }
        })
      )
    )

    return { synced: results.length }
  }
)
