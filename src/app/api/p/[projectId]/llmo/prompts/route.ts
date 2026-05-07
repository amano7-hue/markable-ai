import { getProjectAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { listPrompts, createPrompt, CreatePromptSchema } from '@/modules/llmo'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(req: Request, { params }: Params) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const industry = url.searchParams.get('industry') ?? undefined
  const prompts = await listPrompts(ctx.tenant.id, industry, projectId)
  return ok(prompts)
}

export async function POST(req: Request, { params }: Params) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = CreatePromptSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const prompt = await createPrompt(ctx.tenant.id, parsed.data, projectId)
  return ok(prompt, 201)
}
