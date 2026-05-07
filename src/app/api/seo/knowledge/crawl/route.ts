import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

const Schema = z.object({
  url: z.string().url(),
  category: z.enum(['case_study', 'service', 'company', 'other']),
  title: z.string().optional(),
})

/** HTML からプレーンテキストを抽出（シンプルな実装） */
function extractText(html: string): string {
  return html
    // script・style を除去
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // コメント除去
    .replace(/<!--[\s\S]*?-->/g, '')
    // タグを改行に置換
    .replace(/<\/?(p|div|h[1-6]|li|br|tr|td|th)[^>]*>/gi, '\n')
    // 残りのタグ除去
    .replace(/<[^>]+>/g, '')
    // HTML エンティティ
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // 連続空白・改行を整理
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    // 最大 15000 文字に制限
    .slice(0, 15000)
}

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  const { url, category, title: inputTitle } = parsed.data

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Markable-AI/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return err(`ページの取得に失敗しました (HTTP ${res.status})`, 400)

    const html = await res.text()

    // タイトルを HTML から抽出
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const autoTitle = titleMatch ? titleMatch[1].trim() : url
    const title = inputTitle?.trim() || autoTitle

    const content = extractText(html)
    if (!content || content.length < 50) {
      return err('ページからテキストを抽出できませんでした', 400)
    }

    const project = await prisma.project.findFirst({
      where: { tenantId: ctx.tenant.id },
      select: { id: true },
    })

    const source = await prisma.knowledgeSource.create({
      data: {
        tenantId: ctx.tenant.id,
        projectId: project?.id ?? null,
        type: 'URL',
        category,
        title,
        url,
        content,
        status: 'ready',
      },
    })

    return ok({ id: source.id, title, contentLength: content.length })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      return err('ページの読み込みがタイムアウトしました', 400)
    }
    return err(e instanceof Error ? e.message : 'クロールに失敗しました', 400)
  }
}
