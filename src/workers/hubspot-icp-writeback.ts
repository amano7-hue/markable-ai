import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { getHubSpotClient } from '@/integrations/hubspot'

const BATCH_SIZE = 50

/**
 * HubSpot ICP スコア書き戻しジョブ
 * NurtureLead の icpScore を HubSpot コンタクトプロパティ markable_icp_score に同期する
 * 毎週月曜 10:00 JST 実行
 */
export const hubspotIcpWriteback = inngest.createFunction(
  {
    id: 'hubspot-icp-writeback',
    name: 'HubSpot ICP スコア書き戻し',
    triggers: [{ cron: 'TZ=Asia/Tokyo 0 10 * * 1' }],
  },
  async ({ step, logger }) => {
    const connections = await step.run('fetch-connections', () =>
      prisma.hubSpotConnection.findMany({
        select: { tenantId: true, apiKey: true, portalId: true },
      }),
    )

    logger.info(`HubSpot ICP writeback: ${connections.length} connections`)

    const results = await Promise.all(
      connections.map((conn) =>
        step.run(`icp-writeback-${conn.tenantId}`, async () => {
          // リードを取得
          const leads = await prisma.nurtureLead.findMany({
            where: { tenantId: conn.tenantId },
            select: { hubspotId: true, icpScore: true },
          })

          if (leads.length === 0) return { tenantId: conn.tenantId, updated: 0 }

          const client = getHubSpotClient(conn)
          let updated = 0

          // バッチ処理
          for (let i = 0; i < leads.length; i += BATCH_SIZE) {
            const batch = leads.slice(i, i + BATCH_SIZE)
            await Promise.allSettled(
              batch.map((lead) =>
                client.updateContactProperties(lead.hubspotId, {
                  markable_icp_score: lead.icpScore,
                }),
              ),
            )
            updated += batch.length
          }

          return { tenantId: conn.tenantId, updated }
        }),
      ),
    )

    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0)
    return { tenants: results.length, totalUpdated }
  },
)
