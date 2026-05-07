import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { sourceId } = await params

  await prisma.knowledgeSource.deleteMany({
    where: { id: sourceId, tenantId: ctx.tenant.id },
  })

  return ok({ deleted: true })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { sourceId } = await params

  const source = await prisma.knowledgeSource.findFirst({
    where: { id: sourceId, tenantId: ctx.tenant.id },
  })

  if (!source) return err('Not found', 404)
  return ok(source)
}
