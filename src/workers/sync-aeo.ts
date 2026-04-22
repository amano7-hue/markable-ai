import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { syncDailySnapshots } from '@/modules/aeo'
import { getSerankingClient } from '@/integrations/seranking'

export const syncAeoDaily = inngest.createFunction(
  {
    id: 'sync-aeo-daily',
    name: 'AEO 日次スナップショット同期',
    triggers: [{ cron: 'TZ=Asia/Tokyo 0 2 * * *' }],
  },
  async ({ step, logger }) => {
    const tenants = await step.run('fetch-tenants', () =>
      prisma.tenant.findMany({
        where: { aeoPrompts: { some: { isActive: true } } },
        select: { id: true, ownDomain: true },
      })
    )

    logger.info(`AEO sync: ${tenants.length} tenants`)

    const results = await Promise.all(
      tenants.map((tenant) =>
        step.run(`sync-aeo-${tenant.id}`, async () => {
          const client = getSerankingClient()
          await syncDailySnapshots(tenant.id, tenant.ownDomain ?? '', client, new Date())
          return { tenantId: tenant.id, ok: true }
        })
      )
    )

    return { synced: results.length }
  }
)
