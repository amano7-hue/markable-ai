import { z } from 'zod'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { createPrompt, getTemplates } from '@/modules/llmo'

const BatchSchema = z.object({
  templateIds: z.array(z.string()).min(1).max(20),
  industry: z.string().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = BatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const { templateIds, industry } = parsed.data
  const allTemplates = getTemplates(industry)
  const selected = allTemplates.filter((t) => templateIds.includes(t.id))

  if (selected.length === 0) return err('No matching templates found')

  const results = await Promise.allSettled(
    selected.map((t) =>
      createPrompt(ctx.tenant.id, { text: t.text, industry: t.industry }, projectId),
    ),
  )

  const created = results.filter((r) => r.status === 'fulfilled').length
  const skipped = results.length - created

  return ok({ created, skipped }, 201)
}
