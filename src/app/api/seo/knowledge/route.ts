import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const CreateSchema = z.object({
  type: z.enum(['URL', 'MANUAL', 'PDF']),
  category: z.enum(['case_study', 'service', 'company', 'other']),
  title: z.string().min(1),
  url: z.string().url().optional(),
  content: z.string().min(1),
})

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const sources = await prisma.knowledgeSource.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      category: true,
      title: true,
      url: true,
      status: true,
      createdAt: true,
      content: false, // contentは重いので一覧では除外
    },
  })

  // contentフィールドを除外するため再クエリ
  const list = await prisma.knowledgeSource.findMany({
    where: { tenantId: ctx.tenant.id },
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

  const source = await prisma.knowledgeSource.create({
    data: {
      tenantId: ctx.tenant.id,
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
