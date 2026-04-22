import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { listPrompts, createPrompt, CreatePromptSchema } from '@/modules/aeo'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const prompts = await listPrompts(ctx.tenant.id)
  return ok(prompts)
}

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = CreatePromptSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const prompt = await createPrompt(ctx.tenant.id, parsed.data)
  return ok(prompt, 201)
}
