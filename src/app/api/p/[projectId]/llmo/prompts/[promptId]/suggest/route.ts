import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { detectCitationGaps, generateAndEnqueueSuggestion } from '@/modules/llmo'

type Params = { params: Promise<{ projectId: string; promptId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { projectId, promptId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const gaps = await detectCitationGaps(ctx.tenant.id, ctx.project.ownDomain, projectId)
  const promptGaps = gaps.filter((g) => g.promptId === promptId)

  try {
    const approvalItemId = await generateAndEnqueueSuggestion(
      ctx.tenant.id,
      promptId,
      promptGaps,
    )
    return ok({ approvalItemId }, 202)
  } catch (e) {
    console.error('[llmo/suggest] generateAndEnqueueSuggestion failed:', e)
    return err('改善提案の生成に失敗しました', 500)
  }
}
