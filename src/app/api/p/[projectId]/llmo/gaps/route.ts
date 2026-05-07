import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { detectCitationGaps } from '@/modules/llmo'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const gaps = await detectCitationGaps(ctx.tenant.id, ctx.project.ownDomain, projectId)
  return ok(gaps)
}
