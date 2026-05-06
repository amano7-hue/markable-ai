import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { syncDailySnapshots } from '@/modules/llmo'

// 手動トリガー（ダッシュボードの「LLM 引用チェック」ボタン）
export const syncLlmoOnDemand = inngest.createFunction(
  {
    id: 'sync-llmo-on-demand',
    name: 'LLMO 手動引用チェック',
    triggers: [{ event: 'llmo/sync.requested' }],
  },
  async ({ event, step }) => {
    const { tenantId, ownDomain } = (event as unknown as { data: { tenantId: string; ownDomain: string | null } }).data
    await step.run('sync-snapshots', () =>
      syncDailySnapshots(tenantId, ownDomain, new Date())
    )
    return { tenantId, ok: true }
  },
)

// 日次自動実行
export const syncLlmoDaily = inngest.createFunction(
  {
    id: 'sync-llmo-daily',
    name: 'LLMO 日次スナップショット同期',
    triggers: [{ cron: 'TZ=Asia/Tokyo 0 2 * * *' }],
  },
  async ({ step, logger }) => {
    const tenants = await step.run('fetch-tenants', () =>
      prisma.tenant.findMany({
        where: { aeoPrompts: { some: { isActive: true } } },
        select: { id: true, ownDomain: true },
      })
    )

    logger.info(`LLMO sync: ${tenants.length} tenants`)

    const results = await Promise.all(
      tenants.map((tenant) =>
        step.run(`sync-llmo-${tenant.id}`, async () => {
          await syncDailySnapshots(tenant.id, tenant.ownDomain ?? null, new Date())
          return { tenantId: tenant.id, ok: true }
        })
      )
    )

    return { synced: results.length }
  },
)
