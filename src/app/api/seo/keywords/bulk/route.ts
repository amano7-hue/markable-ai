import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const BulkSchema = z.object({
  keywords: z.array(
    z.object({
      text: z.string().min(1).max(200),
      intent: z.string().nullable().optional(),
    }),
  ).min(1).max(500),
})

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = BulkSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  const { keywords } = parsed.data
  const tenantId = ctx.tenant.id

  // 既存のキーワードテキストを取得して重複を除外
  const existing = await prisma.seoKeyword.findMany({
    where: { tenantId },
    select: { text: true },
  })
  const existingSet = new Set(existing.map((k) => k.text.toLowerCase()))

  const newKeywords = keywords.filter(
    (k) => !existingSet.has(k.text.toLowerCase()),
  )

  if (newKeywords.length === 0) {
    return ok({ created: 0, skipped: keywords.length, message: 'すべてのキーワードが既に登録されています' })
  }

  await prisma.seoKeyword.createMany({
    data: newKeywords.map((k) => ({
      tenantId,
      text: k.text,
      intent: k.intent || null,
    })),
    skipDuplicates: true,
  })

  return ok({
    created: newKeywords.length,
    skipped: keywords.length - newKeywords.length,
  })
}
