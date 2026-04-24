import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const PatchSchema = z.object({
  siteUrl: z.string().min(1),
})

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err('有効なサイト URL を入力してください')

  const connection = await prisma.gscConnection.findUnique({
    where: { tenantId: ctx.tenant.id },
  })
  if (!connection) return err('GSC が接続されていません', 404)

  const updated = await prisma.gscConnection.update({
    where: { tenantId: ctx.tenant.id },
    data: { siteUrl: parsed.data.siteUrl },
    select: { siteUrl: true },
  })

  return ok(updated)
}
