import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'
import { toSlug } from '@/lib/tenant'

const CreateSchema = z.object({
  name: z.string().min(1).max(60),
  ownDomain: z.string().optional(),
})

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const projects = await prisma.project.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, slug: true, ownDomain: true, isDefault: true, createdAt: true },
  })

  return ok(projects)
}

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role === 'MEMBER') return err('Forbidden', 403)

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  const { name, ownDomain } = parsed.data

  // スラッグ重複を避ける
  const base = toSlug(name)
  const existing = await prisma.project.findMany({
    where: { tenantId: ctx.tenant.id, slug: { startsWith: base } },
    select: { slug: true },
  })
  const slugs = new Set(existing.map((p) => p.slug))
  let slug = base
  let i = 2
  while (slugs.has(slug)) { slug = `${base}-${i}`; i++ }

  const project = await prisma.project.create({
    data: {
      tenantId: ctx.tenant.id,
      name,
      slug,
      ownDomain: ownDomain || null,
      isDefault: false,
    },
  })

  return ok(project, 201)
}
