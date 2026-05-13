import { z } from 'zod'
import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { regenerateArticle } from '@/modules/seo'

export const maxDuration = 300

type Params = { params: Promise<{ articleId: string }> }

export async function POST(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { articleId } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = z
    .object({ additionalInstructions: z.string().max(2000).optional() })
    .safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  try {
    await regenerateArticle(ctx.tenant.id, articleId, parsed.data.additionalInstructions)
    return ok({ regenerated: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[seo/articles/regenerate] failed:', msg)
    return err(`再生成に失敗しました: ${msg}`, 500)
  }
}
