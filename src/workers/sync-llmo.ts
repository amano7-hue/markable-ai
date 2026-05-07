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
    const { tenantId, projectId, ownDomain } = (event as unknown as { data: { tenantId: string; projectId?: string; ownDomain: string | null } }).data
    await step.run('sync-snapshots', () =>
      syncDailySnapshots(tenantId, ownDomain, new Date(), undefined, projectId)
    )
    return { tenantId, projectId, ok: true }
  },
)

// 日次自動実行 — プロジェクト単位でループ
export const syncLlmoDaily = inngest.createFunction(
  {
    id: 'sync-llmo-daily',
    name: 'LLMO 日次スナップショット同期',
    triggers: [{ cron: 'TZ=Asia/Tokyo 0 2 */3 * *' }],
  },
  async ({ step, logger }) => {
    const projects = await step.run('fetch-projects', () =>
      prisma.project.findMany({
        where: { aeoPrompts: { some: { isActive: true } } },
        select: { id: true, tenantId: true, ownDomain: true },
      })
    )

    logger.info(`LLMO sync: ${projects.length} projects`)

    const results = await Promise.all(
      projects.map((project) =>
        step.run(`sync-llmo-${project.id}`, async () => {
          await syncDailySnapshots(project.tenantId, project.ownDomain ?? null, new Date(), undefined, project.id)
          return { projectId: project.id, ok: true }
        })
      )
    )

    return { synced: results.length }
  },
)
