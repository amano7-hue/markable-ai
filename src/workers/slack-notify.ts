import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'

async function sendSlack(webhookUrl: string, text: string) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

/**
 * 日次 Slack 通知ジョブ
 * - 承認待ち 3 日以上のアイテムがあれば通知
 * - Seranking クレジットが上限の 80% 以上なら通知
 */
export const slackDailyNotify = inngest.createFunction(
  {
    id: 'slack-daily-notify',
    name: 'Slack 日次通知',
    triggers: [{ cron: 'TZ=Asia/Tokyo 0 18 * * 1-5' }], // 平日 18:00 JST
  },
  async () => {
    const tenants = await prisma.tenant.findMany({
      where: { slackWebhookUrl: { not: null } },
      select: {
        id: true,
        name: true,
        slackWebhookUrl: true,
        serankingCreditBudget: true,
      },
    })

    for (const tenant of tenants) {
      if (!tenant.slackWebhookUrl) continue

      const messages: string[] = []
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      // 承認待ち滞留チェック
      const staleCount = await prisma.approvalItem.count({
        where: {
          tenantId: tenant.id,
          status: 'PENDING',
          createdAt: { lte: threeDaysAgo },
        },
      })
      if (staleCount > 0) {
        messages.push(
          `:clock3: *${tenant.name}* — 承認待ちアイテムが *${staleCount} 件* 3 日以上滞留しています。\n` +
          `→ 承認キューを確認してください`,
        )
      }

      // クレジット使用量チェック
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const creditUsage = await prisma.serankingApiLog.aggregate({
        where: { tenantId: tenant.id, createdAt: { gte: startOfMonth } },
        _sum: { creditsUsed: true },
      })
      const used = creditUsage._sum.creditsUsed ?? 0
      const budget = tenant.serankingCreditBudget ?? 10_000
      const usageRate = (used / budget) * 100

      if (usageRate >= 80) {
        const emoji = usageRate >= 95 ? ':rotating_light:' : ':warning:'
        messages.push(
          `${emoji} *${tenant.name}* — Seranking クレジット使用量が *${Math.round(usageRate)}%* に達しています。\n` +
          `→ ${used.toLocaleString()} / ${budget.toLocaleString()} credits 使用済み`,
        )
      }

      for (const msg of messages) {
        await sendSlack(tenant.slackWebhookUrl, msg)
      }
    }

    return { notified: tenants.length }
  },
)
