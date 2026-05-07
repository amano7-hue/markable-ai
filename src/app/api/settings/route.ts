import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  ownDomain: z.string().optional(),
  slackWebhookUrl: z.string().optional(),
  wpUrl: z.string().optional(),
  wpUsername: z.string().optional(),
  wpAppPassword: z.string().optional(),
  resendFrom: z.string().optional(),
})

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenant.id },
    select: { id: true, name: true, slug: true, ownDomain: true },
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

  const { name, ownDomain, slackWebhookUrl, wpUrl, wpUsername, wpAppPassword, resendFrom } = parsed.data

  const tenant = await prisma.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(ownDomain !== undefined ? { ownDomain: ownDomain || null } : {}),
      ...(slackWebhookUrl !== undefined ? { slackWebhookUrl: slackWebhookUrl || null } : {}),
      ...(wpUrl !== undefined ? { wpUrl: wpUrl || null } : {}),
      ...(wpUsername !== undefined ? { wpUsername: wpUsername || null } : {}),
      ...(wpAppPassword !== undefined ? { wpAppPassword: wpAppPassword || null } : {}),
      ...(resendFrom !== undefined ? { resendFrom: resendFrom || null } : {}),
    },
    select: {
      id: true, name: true, slug: true, ownDomain: true, slackWebhookUrl: true,
      wpUrl: true, wpUsername: true, resendFrom: true,
    },
  })

  return ok(tenant)
}
