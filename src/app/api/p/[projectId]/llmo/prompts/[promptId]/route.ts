import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getPrompt, updatePrompt, deletePrompt, UpdatePromptSchema } from '@/modules/llmo'

type Params = { params: Promise<{ projectId: string; promptId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { projectId, promptId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const prompt = await getPrompt(ctx.tenant.id, promptId, projectId)
  if (!prompt) return err('Not found', 404)
  return ok(prompt)
}

export async function PATCH(req: Request, { params }: Params) {
  const { projectId, promptId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = UpdatePromptSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const prompt = await updatePrompt(ctx.tenant.id, promptId, parsed.data, projectId)
  return ok(prompt)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { projectId, promptId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  await deletePrompt(ctx.tenant.id, promptId, projectId)
  return ok({ deleted: true })
}
