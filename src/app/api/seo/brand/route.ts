import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { Prisma } from '@/generated/prisma'
import { z } from 'zod'

const BrandColorsSchema = z.object({
  primary: z.string().optional(),
  secondary: z.string().optional(),
  accent: z.string().optional(),
  background: z.string().optional(),
  text: z.string().optional(),
}).optional()

const PatchSchema = z.object({
  projectId: z.string().optional(),
  tone: z.string().optional(),
  toneRules: z.array(z.string()).optional(),
  companyDescription: z.string().optional(),
  ngWords: z.array(z.string()).optional(),
  preferredPhrases: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
  diagramPreference: z.string().optional(),
  diagramInstructions: z.string().optional(),
  imageStyleInstructions: z.string().optional(),
  decorationRules: z.string().optional(),
  lineBreakRules: z.string().optional(),
  brandColors: BrandColorsSchema,
  writingModel: z.string().optional(),
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
    diagramPreference: null,
    diagramInstructions: null,
    imageStyleInstructions: null,
    brandColors: null,
  })
}

export async function PUT(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  const {
    projectId, tone, toneRules, companyDescription, ngWords, preferredPhrases,
    diagramPreference, diagramInstructions, imageStyleInstructions, decorationRules, lineBreakRules, brandColors,
    writingModel,
  } = parsed.data

  const project = projectId
    ? await prisma.project.findFirst({ where: { id: projectId, tenantId: ctx.tenant.id }, select: { id: true } })
    : await prisma.project.findFirst({ where: { tenantId: ctx.tenant.id }, select: { id: true } })
  if (!project) return err('プロジェクトが見つかりません', 404)

  const existing = await prisma.brandProfile.findUnique({ where: { projectId: project.id } })

  // JSON フィールドに null を渡す場合は Prisma.JsonNull が必要
  const brandColorsValue = brandColors !== undefined
    ? (brandColors ?? Prisma.JsonNull)
    : undefined

  const profile = existing
    ? await prisma.brandProfile.update({
        where: { projectId: project.id, tenantId: ctx.tenant.id },
        data: {
          ...(tone !== undefined ? { tone: tone || null } : {}),
          ...(companyDescription !== undefined ? { companyDescription: companyDescription || null } : {}),
          ...(toneRules !== undefined ? { toneRules } : {}),
          ...(ngWords !== undefined ? { ngWords } : {}),
          ...(preferredPhrases !== undefined ? { preferredPhrases } : {}),
          ...(diagramPreference !== undefined ? { diagramPreference: diagramPreference || null } : {}),
          ...(diagramInstructions !== undefined ? { diagramInstructions: diagramInstructions || null } : {}),
          ...(imageStyleInstructions !== undefined ? { imageStyleInstructions: imageStyleInstructions || null } : {}),
          ...(decorationRules !== undefined ? { decorationRules: decorationRules || null } : {}),
          ...(lineBreakRules !== undefined ? { lineBreakRules: lineBreakRules || null } : {}),
          ...(brandColorsValue !== undefined ? { brandColors: brandColorsValue } : {}),
          ...(writingModel !== undefined ? { writingModel: writingModel || 'gemini-2.5-flash' } : {}),
        },
      })
    : await prisma.brandProfile.create({
        data: {
          tenantId: ctx.tenant.id,
          projectId: project.id,
          tone: tone ?? null,
          companyDescription: companyDescription ?? null,
          toneRules: toneRules ?? [],
          ngWords: ngWords ?? [],
          preferredPhrases: preferredPhrases ?? [],
          diagramPreference: diagramPreference ?? null,
          diagramInstructions: diagramInstructions ?? null,
          imageStyleInstructions: imageStyleInstructions ?? null,
          decorationRules: decorationRules ?? null,
          lineBreakRules: lineBreakRules ?? null,
          brandColors: brandColors ?? Prisma.JsonNull,
          writingModel: writingModel ?? 'gemini-2.5-flash',
        },
      })

  return ok(profile)
}
