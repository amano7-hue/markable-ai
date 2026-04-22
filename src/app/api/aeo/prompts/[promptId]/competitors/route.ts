import { z } from 'zod'
import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getPrompt, addCompetitor, removeCompetitor } from '@/modules/aeo'
import { prisma } from '@/lib/db/client'

type Params = { params: Promise<{ promptId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { promptId } = await params
  const competitors = await prisma.aeoCompetitor.findMany({
    where: { tenantId: ctx.tenant.id, promptId },
    orderBy: { createdAt: 'asc' },
  })
  return ok(competitors)
}

export async function POST(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { promptId } = await params
  const body = await req.json()
  const parsed = z.object({ domain: z.string().max(253) }).safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const competitor = await addCompetitor(ctx.tenant.id, promptId, parsed.data.domain)
  return ok(competitor, 201)
}

export async function DELETE(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { promptId } = await params
  const body = await req.json()
  const parsed = z.object({ domain: z.string() }).safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  // getPrompt でテナント確認
  const prompt = await getPrompt(ctx.tenant.id, promptId)
  if (!prompt) return err('Not found', 404)

  await removeCompetitor(ctx.tenant.id, promptId, parsed.data.domain)
  return ok({ deleted: true })
}
