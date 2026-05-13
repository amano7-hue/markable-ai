import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const PatchSchema = z.object({
  siteUrl: z.string().min(1),
  projectId: z.string().optional(),
})

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err('有効なサイト URL を入力してください')

  const { siteUrl, projectId } = parsed.data

  const where = projectId
    ? { tenantId: ctx.tenant.id, projectId }
    : { tenantId: ctx.tenant.id }

  const connection = await prisma.gscConnection.findFirst({ where })
  if (!connection) return err('GSC が接続されていません', 404)

  await prisma.gscConnection.updateMany({
    where: { id: connection.id, tenantId: ctx.tenant.id },
    data: { siteUrl },
  })

  return ok({ siteUrl })
}
