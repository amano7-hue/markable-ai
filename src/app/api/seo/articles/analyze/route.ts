import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { analyzeArticle, AnalyzeArticleSchema } from '@/modules/seo'

export const maxDuration = 60

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = AnalyzeArticleSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  try {
    const result = await analyzeArticle(parsed.data.keyword, parsed.data.title)
    return ok(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[seo/articles/analyze] failed:', msg)
    return err(`分析に失敗しました: ${msg}`, 500)
  }
}
