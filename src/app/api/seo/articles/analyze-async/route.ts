import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { generateArticleDraft } from '@/modules/seo/article-service'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'

export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

const HeadingStructureSchema = z.object({
  h1: z.string(),
  sections: z.array(z.object({ h2: z.string(), h3s: z.array(z.string()) })),
})

const StructureSchema = z.object({
  action: z.literal('structure'),
  keyword: z.string().min(1),
  title: z.string().min(1),
  projectId: z.string().optional(),
})

const GenerateSchema = z.object({
  action: z.literal('generate'),
  keyword: z.string().min(1),
  title: z.string().min(1),
  projectId: z.string().optional(),
  ownInsights: z.string().max(10000).optional(),
  relatedKeywords: z.string().max(500).optional(),
  avoidSensationalHeadings: z.boolean().optional(),
  trustedSourcesOnly: z.boolean().optional(),
  customHeadings: HeadingStructureSchema.optional(),
})

const BodySchema = z.discriminatedUnion('action', [StructureSchema, GenerateSchema])

export type NewArticleHeadingItem = { level: 1 | 2 | 3; text: string }

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  // ─── STRUCTURE: Gemini で見出し構成を提案 ─────────────────────────
  if (parsed.data.action === 'structure') {
    const { keyword, title } = parsed.data

    const prompt = `あなたはSEOとコンテンツ設計の専門家です。以下のキーワードと記事タイトルに最適な記事構成（見出し一覧）を提案してください。

キーワード: ${keyword}
記事タイトル: ${title}

以下のルールで見出し構成を提案してください:
- H1は1つだけ（記事タイトルと一致させる）
- H2は5〜8個程度
- 必要に応じてH3を追加（H2の直下のみ）
- BtoB企業向けの専門的な構成にする
- キーワードを自然に含める
- ユーザーの検索意図に応える論理的な流れにする
- 最後のセクションはまとめ・CTAを含める

必ず以下のJSON形式のみで返してください（コードブロック不要）:
{
  "headings": [
    { "level": 1, "text": "H1タイトルテキスト" },
    { "level": 2, "text": "H2見出しテキスト" },
    { "level": 3, "text": "H3見出しテキスト" }
  ]
}`

    try {
      const result = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      })
      const text = result.text ?? ''
      let parsed2: { headings: NewArticleHeadingItem[] }
      try {
        parsed2 = JSON.parse(text)
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return err('構成の生成に失敗しました', 500)
        parsed2 = JSON.parse(jsonMatch[0])
      }
      return ok({ headings: parsed2.headings ?? [] })
    } catch (e) {
      console.error('[new-article/structure] failed:', e)
      return err('構成の生成に失敗しました', 500)
    }
  }

  // ─── GENERATE: generateArticleDraft 直接実行 ──────────────────────
  const {
    keyword,
    title,
    projectId,
    ownInsights,
    relatedKeywords,
    avoidSensationalHeadings,
    trustedSourcesOnly,
    customHeadings,
  } = parsed.data

  try {
    const { articleId } = await generateArticleDraft(ctx.tenant.id, {
      keywordText: keyword,
      title,
      projectId: projectId ?? undefined,
      ownInsights: ownInsights || undefined,
      relatedKeywords: relatedKeywords || undefined,
      avoidSensationalHeadings: avoidSensationalHeadings || undefined,
      trustedSourcesOnly: trustedSourcesOnly || undefined,
      customHeadings: customHeadings ?? undefined,
    })
    return ok({ articleId })
  } catch (e) {
    console.error('[new-article/generate] generateArticleDraft failed:', e)
    return err(e instanceof Error ? e.message : '記事生成に失敗しました', 500)
  }
}
