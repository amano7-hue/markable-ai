import { ok, err } from '@/lib/api-response'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const competitors = await prisma.aeoProjectCompetitor.findMany({
    where: { tenantId: ctx.tenant.id, projectId },
    orderBy: { createdAt: 'asc' },
  })
  return ok(competitors)
}

const AddSchema = z.object({
  domain: z.string().min(1).max(200).transform((d) =>
    d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
  ),
})

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  const parsed = AddSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? '入力が不正です', 400)

  try {
    const record = await prisma.aeoProjectCompetitor.create({
      data: { tenantId: ctx.tenant.id, projectId, domain: parsed.data.domain },
    })
    return ok(record)
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return err('このドメインはすでに登録されています', 409)
    }
    return err('登録に失敗しました', 500)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return err('id が必要です', 400)

  await prisma.aeoProjectCompetitor.deleteMany({
    where: { id, tenantId: ctx.tenant.id, projectId },
  })
  return ok({ ok: true })
}
