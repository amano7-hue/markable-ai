import { z } from 'zod'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getPrompt, addCompetitor, removeCompetitor } from '@/modules/llmo'
import { prisma } from '@/lib/db/client'

type Params = { params: Promise<{ projectId: string; promptId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { projectId, promptId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const competitors = await prisma.aeoCompetitor.findMany({
    where: { tenantId: ctx.tenant.id, promptId, projectId },
    orderBy: { createdAt: 'asc' },
  })
  return ok(competitors)
}

export async function POST(req: Request, { params }: Params) {
  const { projectId, promptId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = z.object({ domain: z.string().max(253) }).safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const competitor = await addCompetitor(ctx.tenant.id, promptId, parsed.data.domain, projectId)
  return ok(competitor, 201)
}

export async function DELETE(req: Request, { params }: Params) {
  const { projectId, promptId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = z.object({ domain: z.string() }).safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const prompt = await getPrompt(ctx.tenant.id, promptId, projectId)
  if (!prompt) return err('Not found', 404)

  await removeCompetitor(ctx.tenant.id, promptId, parsed.data.domain)
  return ok({ deleted: true })
}
