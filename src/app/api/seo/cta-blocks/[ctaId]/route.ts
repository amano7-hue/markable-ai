import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

export async function PATCH(req: Request, { params }: { params: Promise<{ ctaId: string }> }) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { ctaId } = await params
  const body = await req.json()
  const { label, content, isActive } = body

  const data: { label?: string; content?: string; isActive?: boolean } = {}
  if (label) data.label = label
  if (content) data.content = content
  if (typeof isActive === 'boolean') data.isActive = isActive

  const block = await prisma.ctaBlock.updateMany({
    where: { id: ctaId, tenantId: ctx.tenant.id },
    data,
  })
  if (block.count === 0) return err('Not found', 404)
  return ok({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ ctaId: string }> }) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { ctaId } = await params
  await prisma.ctaBlock.deleteMany({ where: { id: ctaId, tenantId: ctx.tenant.id } })
  return ok({ ok: true })
}
