import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { GoogleGenAI } from '@google/genai'
import { prisma } from '@/lib/db/client'
import { generateArticleDraft } from '@/modules/seo/article-service'
import { fetchOrganicResults } from '@/integrations/serpapi/organic'
import { scrapeCompetitorWordCounts } from '@/integrations/serpapi/scraper'
import { z } from 'zod'

// analyze / generate-structure は Gemini 1 回 (~30s)
// rewrite は generateArticleDraft 直接実行 (~3-4 min) のため 300s 必要
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

const AnalyzeSchema = z.object({
  action: z.literal('analyze'),
  url: z.string().url().optional(),
  content: z.string().min(50).optional(),
  targetKeyword: z.string().optional(),
  projectId: z.string().optional(),
  additionalUrls: z.array(z.string().url()).max(5).optional(),
})

const RewriteSchema = z.object({
  action: z.literal('rewrite'),
  content: z.string().min(50).max(50000),
  title: z.string().optional(),
  targetKeyword: z.string().optional(),
  selectedSuggestions: z.array(z.string()),
  additionalInstructions: z.string().optional(),
  projectId: z.string().optional(),
  competitorAvgWordCount: z.number().optional(),
  externalLinksNewTab: z.boolean().optional(),
})

const GenerateStructureSchema = z.object({
  action: z.literal('generate-structure'),
  content: z.string().min(50),
  title: z.string().optional(),
  targetKeyword: z.string().optional(),
  selectedSuggestions: z.array(z.string()),
  additionalInstructions: z.string().max(2000).optional(),
  relatedKeywords: z.string().max(500).optional(),
})

const BodySchema = z.discriminatedUnion('action', [AnalyzeSchema, RewriteSchema, GenerateStructureSchema])

/** URLからHTMLを取得してテキスト抽出 */
async function fetchArticleContent(url: string): Promise<{ text: string; title: string | null }> {
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

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : null

  let body = html
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (articleMatch) body = articleMatch[1]
  else if (mainMatch) body = mainMatch[1]

  const text = body
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

  return { text, title }
}

export type RewriteSuggestion = {
  id: string
  category: 'title' | 'headings' | 'intro' | 'keyword_density' | 'direct_answer' | 'faq' | 'entity' | 'structure' | 'cta' | 'llmo'
  label: string
  issue: string
  suggestion: string
  priority: 'high' | 'medium' | 'low'
}

export type HeadingItem = { level: 1 | 2 | 3 | 4 | 5; text: string; description?: string }

export type AnalyzeResult = {
  title: string | null
  content: string
  score: number
  suggestions: RewriteSuggestion[]
  competitor: {
    averageWordCount: number
    recommendedWordCount: number
    scrapedPages: Array<{ url: string; charCount: number; title: string | null }>
    scrapeSuccess: boolean
  } | null
  currentWordCount: number
  additionalContent?: string
}

export async function POST(req: Request) {
  try {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json().catch(() => null)
  if (!body) return err('リクエストボディが不正です', 400)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  // ─── ANALYZE ────────────────────────────────────────────────────
  if (parsed.data.action === 'analyze') {
    const { url, content, targetKeyword, additionalUrls } = parsed.data
    if (!url && !content) return err('url または content が必要です', 400)

    let articleText = content ?? ''
    let articleTitle: string | null = null

    if (url) {
      try {
        const fetched = await fetchArticleContent(url)
        articleText = fetched.text
        articleTitle = fetched.title
      } catch (e) {
        return err(`URLの取得に失敗しました: ${e instanceof Error ? e.message : 'Unknown error'}`, 400)
      }
    }

    const currentWordCount = articleText.replace(/\s+/g, '').length

    // SERP + 競合文字数取得（キーワードがある場合）
    let competitorData: AnalyzeResult['competitor'] = null
    if (targetKeyword) {
      try {
        const serpApiKey = process.env.SERPAPI_API_KEY ?? ''
        if (!serpApiKey) throw new Error('SERPAPI_API_KEY not set')
        const serpResult = await fetchOrganicResults(targetKeyword, serpApiKey)
        const topUrls = serpResult.organicResults.slice(0, 5).map((r) => r.link).filter(Boolean) as string[]
        if (topUrls.length > 0) {
          const scrapeResult = await scrapeCompetitorWordCounts(topUrls)
          if (scrapeResult.pages.length > 0) {
            competitorData = {
              averageWordCount: scrapeResult.averageCharCount,
              recommendedWordCount: scrapeResult.recommendedCharCount,
              scrapedPages: scrapeResult.pages,
              scrapeSuccess: true,
            }
          }
        }
      } catch {
        // SERP失敗は無視
      }
    }

    // SEO/LLMO分析
    const analyzePrompt = `
あなたはSEO・LLMOの専門家です。以下の記事を分析し、改善提案をJSON形式で返してください。

${articleTitle ? `記事タイトル: ${articleTitle}` : ''}
${targetKeyword ? `ターゲットキーワード: ${targetKeyword}` : ''}
現在の文字数: ${currentWordCount.toLocaleString()}文字
${competitorData ? `競合平均文字数: ${competitorData.averageWordCount.toLocaleString()}文字（目標: ${competitorData.recommendedWordCount.toLocaleString()}文字以上）` : ''}

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
      try {
        parsed2 = JSON.parse(jsonMatch[0])
      } catch {
        return err('分析結果の解析に失敗しました', 500)
      }
    }

    // 統合する追加記事のコンテンツ取得
    let additionalContent: string | undefined
    if (additionalUrls && additionalUrls.length > 0) {
      const results = await Promise.allSettled(additionalUrls.map((u) => fetchArticleContent(u)))
      const parts = results
        .map((r, i) => r.status === 'fulfilled'
          ? `【統合記事${i + 1}: ${r.value.title ?? additionalUrls[i]}】\n${r.value.text.slice(0, 10000)}`
          : null)
        .filter(Boolean) as string[]
      if (parts.length > 0) additionalContent = parts.join('\n\n---\n\n')
    }

    return ok({
      title: articleTitle,
      content: articleText,
      score: parsed2.score ?? 0,
      suggestions: parsed2.suggestions ?? [],
      competitor: competitorData,
      currentWordCount,
      additionalContent,
    } satisfies AnalyzeResult)
  }

  // ─── GENERATE STRUCTURE ─────────────────────────────────────────
  if (parsed.data.action === 'generate-structure') {
    const { content, title, targetKeyword, selectedSuggestions, additionalInstructions, relatedKeywords } = parsed.data

    const structurePrompt = `
あなたはSEOとコンテンツ設計の専門家です。以下の既存記事と改善指示をもとに、リライト後の最適な記事構成（見出し一覧）を提案してください。

${title ? `既存タイトル: ${title}` : ''}
${targetKeyword ? `ターゲットキーワード: ${targetKeyword}` : ''}
${relatedKeywords ? `関連キーワード（見出しに含めること）: ${relatedKeywords}` : ''}

改善指示:
${selectedSuggestions.length > 0 ? selectedSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n') : '（なし）'}
${additionalInstructions ? `\n【追加指示 — 最優先で必ず守ること】:\n${additionalInstructions}` : ''}

既存記事（先頭5000文字）:
---
${content.slice(0, 5000)}
---

以下のルールで見出し構成を提案してください:
- H1は1つだけ（記事タイトル）
- H2は5〜8個程度
- 必要に応じてH3を追加（H2の直下）
- 内容の複雑さや階層化が必要な場合のみH4・H5を使用（H3の直下）
- キーワードを自然に含める
- ユーザーの検索意図に応える論理的な流れにする
- 改善指示が「見出し構成」に関するものであればそれを優先反映する
${relatedKeywords ? `- 関連キーワード（${relatedKeywords}）を適切なH2またはH3見出しに含めること` : ''}
${additionalInstructions ? `- 【最優先】追加指示を厳守すること: ${additionalInstructions}` : ''}

必ず以下のJSON形式のみで返してください（コードブロック不要）:
{
  "headings": [
    { "level": 1, "text": "H1タイトルテキスト", "description": "記事全体の目的・読者への提供価値" },
    { "level": 2, "text": "H2見出しテキスト", "description": "このセクションで扱う内容の概要（1〜2文）" },
    { "level": 3, "text": "H3見出しテキスト", "description": "H3で掘り下げる具体的なポイント" },
    { "level": 4, "text": "H4見出しテキスト", "description": "さらに詳細な内容の説明" },
    { "level": 5, "text": "H5見出しテキスト", "description": "最小単位の補足内容" }
  ]
}
`
    const result = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: structurePrompt,
      config: { responseMimeType: 'application/json' },
    })

    const text = result.text ?? ''
    let parsed2: { headings: HeadingItem[] }
    try {
      parsed2 = JSON.parse(text)
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return err('構成の生成に失敗しました', 500)
      try {
        parsed2 = JSON.parse(jsonMatch[0])
      } catch {
        return err('構成の生成に失敗しました', 500)
      }
    }

    return ok({ headings: parsed2.headings ?? [] })
  }

  // ─── REWRITE (直接実行) ──────────────────────────────────────────
  const {
    content,
    title,
    targetKeyword,
    selectedSuggestions,
    additionalInstructions,
    projectId,
    competitorAvgWordCount,
    externalLinksNewTab,
  } = parsed.data

  const articleTitle = title ?? (targetKeyword ? `${targetKeyword}（リライト）` : 'リライト記事')

  // 選択した改善提案を additionalInstructions として組み立て
  const suggestionText = selectedSuggestions.length > 0
    ? `【リライト改善指示】\n${selectedSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : ''
  const competitorText = competitorAvgWordCount
    ? `\n【競合平均文字数】${competitorAvgWordCount.toLocaleString()}文字 — これより多い文字数で生成すること`
    : ''
  const extraText = additionalInstructions ? `\n【追加指示】\n${additionalInstructions}` : ''

  const fullAdditionalInstructions = [suggestionText, competitorText, extraText].filter(Boolean).join('\n')

  // 既存記事本文を ownInsights として渡す（最大9000文字）
  const ownInsights = `【リライト元記事（以下の内容をベースに改善・拡充すること）】\n${content.slice(0, 50000)}`

  // リライト理由（選択した改善提案 + 追加指示）
  const rewriteReasons: string[] = [
    ...selectedSuggestions,
    ...(additionalInstructions ? [`追加指示: ${additionalInstructions}`] : []),
  ]

  try {
    const { articleId } = await generateArticleDraft(ctx.tenant.id, {
      keywordText: targetKeyword ?? articleTitle,
      title: articleTitle,
      projectId: projectId ?? undefined,
      ownInsights,
      additionalInstructions: fullAdditionalInstructions || undefined,
      externalLinksNewTab: externalLinksNewTab || undefined,
      sourceContent: content.slice(0, 50000),
      rewriteReasons: rewriteReasons.length > 0 ? rewriteReasons : undefined,
    })
    return ok({ articleId })
  } catch (e) {
    console.error('[rewrite] generateArticleDraft failed:', e)
    return err(e instanceof Error ? e.message : '記事生成に失敗しました', 500)
  }

  } catch (e) {
    console.error('[rewrite-existing] unhandled error:', e)
    return err(e instanceof Error ? e.message : '予期しないエラーが発生しました', 500)
  }
}
