import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const PatchSchema = z.object({
  tone: z.string().optional(),
  companyDescription: z.string().optional(),
  ngWords: z.array(z.string()).optional(),
  preferredPhrases: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
})

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const profile = await prisma.brandProfile.findUnique({
    where: { tenantId: ctx.tenant.id },
  })

  return ok(profile ?? {
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

  const { tone, companyDescription, ngWords, preferredPhrases } = parsed.data

  const profile = await prisma.brandProfile.upsert({
    where: { tenantId: ctx.tenant.id },
    create: {
      tenantId: ctx.tenant.id,
      tone: tone ?? null,
      companyDescription: companyDescription ?? null,
      ngWords: ngWords ?? [],
      preferredPhrases: preferredPhrases ?? [],
    },
    update: {
      ...(tone !== undefined ? { tone: tone || null } : {}),
      ...(companyDescription !== undefined ? { companyDescription: companyDescription || null } : {}),
      ...(ngWords !== undefined ? { ngWords } : {}),
      ...(preferredPhrases !== undefined ? { preferredPhrases } : {}),
    },
  })

  return ok(profile)
}
