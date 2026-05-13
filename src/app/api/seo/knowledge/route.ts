import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const CreateSchema = z.object({
  projectId: z.string().optional(),
  type: z.enum(['URL', 'MANUAL', 'PDF']),
  category: z.enum(['case_study', 'service', 'company', 'other']),
  title: z.string().min(1),
  url: z.string().url().optional(),
  content: z.string().min(1),
})

/** projectId を解決する。未指定ならデフォルトプロジェクトを返す（null は絶対に保存しない） */
async function resolveProjectId(tenantId: string, projectId?: string): Promise<string | null> {
  if (projectId) {
    const p = await prisma.project.findFirst({ where: { id: projectId, tenantId }, select: { id: true } })
    return p?.id ?? null
  }
  const p = await prisma.project.findFirst({
    where: { tenantId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  return p?.id ?? null
}

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  const where = projectId
    ? { tenantId: ctx.tenant.id, projectId }
    : { tenantId: ctx.tenant.id }

  const list = await prisma.knowledgeSource.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, category: true, title: true, url: true, status: true, createdAt: true },
  })

  return ok(list)
}

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  const pid = await resolveProjectId(ctx.tenant.id, parsed.data.projectId)
  if (!pid) return err('プロジェクトが見つかりません', 404)

  const source = await prisma.knowledgeSource.create({
    data: {
      tenantId: ctx.tenant.id,
      projectId: pid,
      type: parsed.data.type,
      category: parsed.data.category,
      title: parsed.data.title,
      url: parsed.data.url ?? null,
      content: parsed.data.content,
      status: 'ready',
    },
  })

  return ok(source)
}
