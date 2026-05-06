import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  ownDomain: z.string().optional(),
  serankingProjectId: z.string().optional(),
  slackWebhookUrl: z.string().optional(),
  serankingCreditBudget: z.number().int().min(1000).max(1_000_000).optional(),
})

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenant.id },
    select: { id: true, name: true, slug: true, ownDomain: true, serankingProjectId: true },
  })

  return ok(tenant)
}

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.flatten() as unknown as string, 400)
  }

  const { name, ownDomain, serankingProjectId, slackWebhookUrl, serankingCreditBudget } = parsed.data

  const tenant = await prisma.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(ownDomain !== undefined ? { ownDomain: ownDomain || null } : {}),
      ...(serankingProjectId !== undefined
        ? { serankingProjectId: serankingProjectId || null }
        : {}),
      ...(slackWebhookUrl !== undefined ? { slackWebhookUrl: slackWebhookUrl || null } : {}),
      ...(serankingCreditBudget !== undefined ? { serankingCreditBudget } : {}),
    },
    select: {
      id: true, name: true, slug: true, ownDomain: true,
      serankingProjectId: true, slackWebhookUrl: true, serankingCreditBudget: true,
    },
  })

  return ok(tenant)
}
