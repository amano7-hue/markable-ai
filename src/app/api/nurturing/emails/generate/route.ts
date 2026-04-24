import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { generateEmailDraft, GenerateEmailSchema } from '@/modules/nurturing'

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = GenerateEmailSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  try {
    const result = await generateEmailDraft(ctx.tenant.id, parsed.data)
    return ok(result, 202)
  } catch (e) {
    console.error('[nurturing/emails/generate] generateEmailDraft failed:', e)
    return err('メールドラフトの生成に失敗しました', 500)
  }
}
