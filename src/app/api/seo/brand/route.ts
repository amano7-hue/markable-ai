import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const PatchSchema = z.object({
  projectId: z.string().optional(),
  tone: z.string().optional(),
  companyDescription: z.string().optional(),
  ngWords: z.array(z.string()).optional(),
  preferredPhrases: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
})

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const project = await prisma.project.findFirst({
    where: { tenantId: ctx.tenant.id },
    select: { id: true, brandProfile: true },
  })

  return ok(project?.brandProfile ?? {
    tone: null,
    companyDescription: null,
    ngWords: [],
    preferredPhrases: [],
  })
}

export async function PUT(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  const { projectId, tone, companyDescription, ngWords, preferredPhrases } = parsed.data

  const project = projectId
    ? await prisma.project.findFirst({ where: { id: projectId, tenantId: ctx.tenant.id }, select: { id: true } })
    : await prisma.project.findFirst({ where: { tenantId: ctx.tenant.id }, select: { id: true } })
  if (!project) return err('プロジェクトが見つかりません', 404)

  const existing = await prisma.brandProfile.findUnique({ where: { projectId: project.id } })

  const profile = existing
    ? await prisma.brandProfile.update({
        where: { projectId: project.id },
        data: {
          ...(tone !== undefined ? { tone: tone || null } : {}),
          ...(companyDescription !== undefined ? { companyDescription: companyDescription || null } : {}),
          ...(ngWords !== undefined ? { ngWords } : {}),
          ...(preferredPhrases !== undefined ? { preferredPhrases } : {}),
        },
      })
    : await prisma.brandProfile.create({
        data: {
          tenantId: ctx.tenant.id,
          projectId: project.id,
          tone: tone ?? null,
          companyDescription: companyDescription ?? null,
          ngWords: ngWords ?? [],
          preferredPhrases: preferredPhrases ?? [],
        },
      })

  return ok(profile)
}
