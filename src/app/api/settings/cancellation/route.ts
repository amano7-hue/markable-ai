import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const Schema = z.object({
  reason: z.string().max(2000).optional(),
})

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role !== 'OWNER') return err('OWNER 権限が必要です', 403)

  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  // 既存の申請があれば重複防止
  const existing = await prisma.cancellationRequest.findFirst({
    where: { tenantId: ctx.tenant.id },
  })
  if (existing) return err('解約申請はすでに受け付けています', 409)

  await prisma.cancellationRequest.create({
    data: { tenantId: ctx.tenant.id, reason: parsed.data.reason ?? null },
  })

  // Slack 通知（webhook 設定時のみ）
  const webhookUrl = ctx.tenant.slackWebhookUrl
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🔴 解約申請が届きました\n*テナント*: ${ctx.tenant.name} (${ctx.tenant.id})\n*申請者*: ${ctx.user.email}\n*理由*: ${parsed.data.reason ?? '（未入力）'}`,
      }),
    }).catch(() => {})
  }

  return ok({ submitted: true })
}
