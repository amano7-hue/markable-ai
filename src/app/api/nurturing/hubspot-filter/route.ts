import { ok, err } from '@/lib/api-response'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const Schema = z.object({
  projectId: z.string(),
  lifecycles: z.array(z.string()).optional().default([]),
  leadStatuses: z.array(z.string()).optional().default([]),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return err('入力が不正です', 400)

  const { projectId, lifecycles, leadStatuses } = parsed.data

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
      },
    },
  })

  return ok({ ok: true })
}
