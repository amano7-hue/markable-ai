import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { GoogleGenAI } from '@google/genai'
import { optimizeHtml } from '@/modules/seo/article-service'
import { z } from 'zod'

export const maxDuration = 120

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

const AnalyzeSchema = z.object({
  action: z.literal('analyze'),
  url: z.string().url().optional(),
  content: z.string().min(50).optional(),
  targetKeyword: z.string().optional(),
})

const RewriteSchema = z.object({
  action: z.literal('rewrite'),
  content: z.string().min(50),
  targetKeyword: z.string().optional(),
  selectedSuggestions: z.array(z.string()),
  additionalInstructions: z.string().optional(),
})

const BodySchema = z.discriminatedUnion('action', [AnalyzeSchema, RewriteSchema])

/** URLからHTMLを取得してテキスト抽出 */
async function fetchArticleContent(url: string): Promise<{ html: string; title: string | null }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ja,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  // title 抽出
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : null

  // 記事本文抽出（article, main, .content などの順で試みる）
  let body = html
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (articleMatch) body = articleMatch[1]
  else if (mainMatch) body = mainMatch[1]

  // タグ除去
  const text = body
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

  return { html: text, title }
}

export type RewriteSuggestion = {
  id: string
  category: 'title' | 'headings' | 'intro' | 'keyword_density' | 'direct_answer' | 'faq' | 'entity' | 'structure' | 'cta' | 'llmo'
  label: string
  issue: string
  suggestion: string
  priority: 'high' | 'medium' | 'low'
}

export type AnalyzeResult = {
  title: string | null
  content: string
  score: number
  suggestions: RewriteSuggestion[]
}

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  if (parsed.data.action === 'analyze') {
    const { url, content, targetKeyword } = parsed.data
    if (!url && !content) return err('url または content が必要です', 400)

    let articleText = content ?? ''
    let articleTitle: string | null = null

    if (url) {
      try {
        const fetched = await fetchArticleContent(url)
        articleText = fetched.html
        articleTitle = fetched.title
      } catch (e) {
        return err(`URLの取得に失敗しました: ${e instanceof Error ? e.message : 'Unknown error'}`, 400)
      }
    }

    const analyzePrompt = `
あなたはSEO・LLMOの専門家です。以下の記事を分析し、改善提案をJSON形式で返してください。

${articleTitle ? `記事タイトル: ${articleTitle}` : ''}
${targetKeyword ? `ターゲットキーワード: ${targetKeyword}` : ''}

記事本文:
---
${articleText.slice(0, 8000)}
---

以下の観点で分析し、具体的な改善提案を最大10件返してください。

分析観点:
1. titleタグ・H1最適化（キーワード含有、文字数、クリック率）
2. 見出し構成（H2/H3の論理構造、キーワード含有）
3. 導入文（検索意図への即応、ユーザーの離脱防止）
4. キーワード密度（適切な出現頻度、共起語の活用）
5. ダイレクトアンサー（PAA/SFOに対応した明確な回答）
6. FAQ構造（StructuredData対応のFAQセクション）
7. エンティティの明確化（専門用語・固有名詞の説明）
8. コンテンツ構造（表・リスト・図解の活用）
9. CTA・コンバージョン導線
10. LLMO対応（AI検索での引用しやすさ、権威性、一次情報）

必ず以下のJSON形式で返してください（マークダウンコードブロック不要）:
{
  "score": 0-100の数値（現在のSEO/LLMO対応スコア）,
  "suggestions": [
    {
      "id": "unique_id",
      "category": "title|headings|intro|keyword_density|direct_answer|faq|entity|structure|cta|llmo",
      "label": "改善項目名（短い）",
      "issue": "現在の問題点（具体的に）",
      "suggestion": "改善提案（具体的に。可能なら修正後のテキスト例も含める）",
      "priority": "high|medium|low"
    }
  ]
}
`

    const result = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: analyzePrompt,
      config: { responseMimeType: 'application/json' },
    })

    const text = result.text ?? ''
    let parsed2: { score: number; suggestions: RewriteSuggestion[] }
    try {
      parsed2 = JSON.parse(text)
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return err('分析結果の解析に失敗しました', 500)
      parsed2 = JSON.parse(jsonMatch[0])
    }

    return ok({
      title: articleTitle,
      content: articleText,
      score: parsed2.score ?? 0,
      suggestions: parsed2.suggestions ?? [],
    } satisfies AnalyzeResult)
  }

  // action === 'rewrite'
  const { content, targetKeyword, selectedSuggestions, additionalInstructions } = parsed.data

  const rewritePrompt = `
あなたはSEO・LLMOの専門家です。以下の記事を、指定された改善指示に従ってリライトしてください。

${targetKeyword ? `ターゲットキーワード: ${targetKeyword}` : ''}

元の記事:
---
${content.slice(0, 8000)}
---

適用する改善指示:
${selectedSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}
${additionalInstructions ? `\n追加指示:\n${additionalInstructions}` : ''}

リライトルール:
- 元の記事の情報・事実・数字は保持する
- 読者にとって価値のあるコンテンツを追加・強化する
- SEO観点でタイトル・見出し・キーワード密度を最適化する
- LLMO観点でAI検索に引用されやすい構造・表現にする
- 日本語で執筆すること
- 出力はHTML形式（h1, h2, h3, p, ul, ol, strong, mark, em, table, details/summary タグ使用可）
- HTMLタグ以外のマークダウン記法は使わない

リライト後の記事のみ出力してください（説明・前置き不要）:
`

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: rewritePrompt,
  })

  const rewrittenContent = optimizeHtml(result.text ?? '')

  return ok({ rewrittenContent })
}
