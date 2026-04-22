import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { detectCitationGaps, generateAndEnqueueSuggestion } from '@/modules/aeo'

type Params = { params: Promise<{ promptId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { promptId } = await params
  const gaps = await detectCitationGaps(ctx.tenant.id, ctx.tenant.ownDomain)
  const promptGaps = gaps.filter((g) => g.promptId === promptId)

  const approvalItemId = await generateAndEnqueueSuggestion(
    ctx.tenant.id,
    promptId,
    promptGaps,
  )

  return ok({ approvalItemId }, 202)
}
