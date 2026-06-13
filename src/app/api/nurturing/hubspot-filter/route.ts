import { ok, err } from '@/lib/api-response'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const CustomConditionSchema = z.object({
  objectType: z.enum(['contact', 'deal']),
  field: z.string().min(1),
  operator: z.enum(['eq', 'neq', 'contains', 'in', 'not_empty']),
  value: z.union([z.string(), z.array(z.string())]).optional(),
})

const Schema = z.object({
  projectId: z.string(),
  lifecycles: z.array(z.string()).optional().default([]),
  leadStatuses: z.array(z.string()).optional().default([]),
  customConditions: z.array(CustomConditionSchema).optional().default([]),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? '入力が不正です', 400)

  const { projectId, lifecycles, leadStatuses, customConditions } = parsed.data

  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const conn = await prisma.hubSpotConnection.findUnique({ where: { projectId } })
  if (!conn) return err('HubSpot が接続されていません', 404)

  await prisma.hubSpotConnection.update({
    where: { projectId },
    data: {
      importFilter: {
        lifecycles: lifecycles.length > 0 ? lifecycles : undefined,
        leadStatuses: leadStatuses.length > 0 ? leadStatuses : undefined,
        customConditions: customConditions.length > 0 ? customConditions : undefined,
      },
    },
  })

  return ok({ ok: true })
}
