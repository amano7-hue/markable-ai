import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { GenerateArticleSchema } from '@/modules/seo'
import { inngest } from '@/lib/inngest/client'

export async function POST(req: Request) {
  try {
    const ctx = await getAuth()
    if (!ctx) return err('Unauthorized', 401)

    const body = await req.json().catch(() => null)
    if (!body) return err('リクエストボディが不正です', 400)

    const parsed = GenerateArticleSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.message)

    await inngest.send({
      name: 'seo/article.draft.requested',
      data: { tenantId: ctx.tenant.id, input: parsed.data },
    })

    return ok({ queued: true }, 202)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[seo/articles/generate] failed:', msg)
    return err(`記事の生成に失敗しました: ${msg}`, 500)
  }
}
