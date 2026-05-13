import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { generateArticleDraft, GenerateArticleSchema } from '@/modules/seo'

export const maxDuration = 300 // Vercel Pro: 5分

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = GenerateArticleSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  try {
    const result = await generateArticleDraft(ctx.tenant.id, parsed.data)
    return ok(result, 202)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[seo/articles/generate] failed:', msg)
    return err(`記事の生成に失敗しました: ${msg}`, 500)
  }
}
