import { GoogleGenAI } from '@google/genai'
import { prisma } from '@/lib/db/client'
import type { GenerateArticleInput } from './schemas'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

interface ReaderAnalysis {
  searchIntent: 'informational' | 'navigational' | 'transactional' | 'commercial'
  targetAudience: string
  keyQuestions: string[]
  painPoints: string[]
}

interface CompetitorAnalysis {
  recommendedWordCount: number
  minWordCount: number
  maxWordCount: number
  reasoning: string
}

interface HeadingStructure {
  h1: string
  sections: Array<{
    h2: string
    h3s: string[]
  }>
}

export interface ArticleAnalysis {
  reader: ReaderAnalysis
  competitor: CompetitorAnalysis
  headings: HeadingStructure
}

async function analyzeReaderNeeds(title: string, keyword: string | null): Promise<ReaderAnalysis> {
  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `BtoBマーケティング記事の読者ニーズを分析してください。

タイトル: "${title}"
${keyword ? `ターゲットキーワード: "${keyword}"` : ''}

以下のJSON形式のみで回答してください:
{
  "searchIntent": "informational" | "navigational" | "transactional" | "commercial",
  "targetAudience": "想定読者の説明（1文）",
  "keyQuestions": ["読者が知りたいこと1", "読者が知りたいこと2", "読者が知りたいこと3"],
  "painPoints": ["読者の課題1", "読者の課題2", "読者の課題3"]
}`,
  })
  const text = result.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('読者分析の生成に失敗しました')
  return JSON.parse(match[0]) as ReaderAnalysis
}

async function analyzeCompetitorWordCount(title: string, keyword: string | null): Promise<CompetitorAnalysis> {
  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `SEO観点で検索上位に入るための最適な文字数を分析してください。

タイトル: "${title}"
${keyword ? `ターゲットキーワード: "${keyword}"` : ''}

検索意図・競合コンテンツの一般的な傾向を踏まえ、以下のJSON形式のみで回答してください:
{
  "recommendedWordCount": 推奨文字数（整数）,
  "minWordCount": 最低文字数（整数）,
  "maxWordCount": 最大文字数（整数）,
  "reasoning": "この文字数を推奨する理由（1〜2文）"
}`,
  })
  const text = result.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('競合分析の生成に失敗しました')
  return JSON.parse(match[0]) as CompetitorAnalysis
}

async function generateHeadingStructure(
  title: string,
  keyword: string | null,
  reader: ReaderAnalysis,
  wordCount: number,
): Promise<HeadingStructure> {
  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `BtoBマーケティング向けSEO記事の見出し構成を設計してください。

タイトル: "${title}"
${keyword ? `ターゲットキーワード: "${keyword}"` : ''}
想定読者: ${reader.targetAudience}
読者の主な疑問: ${reader.keyQuestions.join(' / ')}
読者の課題: ${reader.painPoints.join(' / ')}
目標文字数: ${wordCount}文字

以下のJSON形式のみで回答してください:
{
  "h1": "H1見出し（キーワードを含む、魅力的なタイトル）",
  "sections": [
    {
      "h2": "H2見出し",
      "h3s": ["H3見出し1", "H3見出し2"]
    }
  ]
}

【設計方針】
- H2は4〜6個（文字数に応じて調整）
- 各H2に1〜3個のH3を設置
- 読者の疑問・課題を解決する流れで構成
- 最後のセクションはまとめ・CTAを含める`,
  })
  const text = result.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('見出し構成の生成に失敗しました')
  return JSON.parse(match[0]) as HeadingStructure
}

async function generateArticleDraftContent(
  title: string,
  keyword: string | null,
  reader: ReaderAnalysis,
  competitor: CompetitorAnalysis,
  headings: HeadingStructure,
  ownInsights?: string | null,
): Promise<string> {
  const structureText = headings.sections
    .map((s) => `## ${s.h2}\n${s.h3s.map((h) => `### ${h}`).join('\n')}`)
    .join('\n\n')

  const ownInsightsSection = ownInsights
    ? `
# 【最重要】提供された独自情報・事例（必ず記事に組み込むこと）
${ownInsights}

上記の独自情報は、競合記事との差別化の核心です。事実を正確に維持しながら、
記事の適切なセクションに自然に組み込んでください。数字・事例・固有名詞はそのまま使用してください。
`
    : ''

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `以下の条件でBtoBマーケティング向けSEO記事を日本語で執筆してください。
${ownInsightsSection}
# 執筆条件
- タイトル: "${title}"
${keyword ? `- ターゲットキーワード: "${keyword}"（自然に3〜5回使用）` : ''}
- 想定読者: ${reader.targetAudience}
- 目標文字数: ${competitor.recommendedWordCount}文字（${competitor.minWordCount}〜${competitor.maxWordCount}文字の範囲）
- 検索意図: ${reader.searchIntent}

# 読者が知りたいこと
${reader.keyQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

# 読者の課題
${reader.painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

# 見出し構成（この構成に沿って執筆すること）
# ${headings.h1}

${structureText}

# 品質要件
1. **独自性**: ${ownInsights ? '提供された独自情報・事例を最大限活用し、他では読めない内容にする' : '具体的な数字・事例・独自の視点を必ず含める'}
2. **構造**: 指定の見出し構成（H1/H2/H3）を忠実に使用し、Markdown形式で出力
3. **読みやすさ**: 各段落は3〜5文。箇条書きや表を効果的に使用
4. **専門性**: BtoB企業のマーケティング担当者が「参考になった」と感じる深さで執筆
5. **CTA**: 最後のセクションに自然な形でCTAを含める

記事本文のみを出力してください（前置きや説明文は不要）。`,
  })
  return result.text ?? ''
}

export async function generateArticleDraft(
  tenantId: string,
  input: GenerateArticleInput,
): Promise<{ articleId: string; approvalItemId: string }> {
  let keywordText: string | null = null

  if (input.keywordId) {
    const kw = await prisma.seoKeyword.findFirst({
      where: { id: input.keywordId, tenantId },
      select: { text: true },
    })
    keywordText = kw?.text ?? null
  }

  // Step 1 & 2: 読者ニーズ分析 + 競合文字数分析（並列）
  const [reader, competitor] = await Promise.all([
    analyzeReaderNeeds(input.title, keywordText),
    analyzeCompetitorWordCount(input.title, keywordText),
  ])

  // Step 3: 見出し構成
  const headings = await generateHeadingStructure(input.title, keywordText, reader, competitor.recommendedWordCount)

  // Step 4: 記事本文生成
  const draft = await generateArticleDraftContent(input.title, keywordText, reader, competitor, headings, input.ownInsights)

  // Step 5: 分析サマリーをブリーフとして保存
  const brief = [
    `【検索意図】${reader.searchIntent}`,
    `【想定読者】${reader.targetAudience}`,
    `【読者の疑問】${reader.keyQuestions.join(' / ')}`,
    `【推奨文字数】${competitor.recommendedWordCount}文字（${competitor.minWordCount}〜${competitor.maxWordCount}）`,
    `【競合分析】${competitor.reasoning}`,
  ].join('\n')

  const analysis: ArticleAnalysis = { reader, competitor, headings }

  const article = await prisma.seoArticle.create({
    data: {
      tenantId,
      keywordId: input.keywordId ?? null,
      title: input.title,
      analysis,
      brief,
      draft,
    },
  })

  const approvalItem = await prisma.approvalItem.create({
    data: {
      tenantId,
      module: 'seo',
      type: 'seo_article_draft',
      payload: {
        articleId: article.id,
        keywordId: input.keywordId ?? null,
        keywordText,
        title: input.title,
        brief,
        draft,
        analysis,
        generatedAt: new Date().toISOString(),
      },
    },
  })

  return { articleId: article.id, approvalItemId: approvalItem.id }
}

const ARTICLE_PAGE_SIZE = 20

export async function listArticles(tenantId: string, status?: string, page = 1) {
  const where = {
    tenantId,
    ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
  }
  const skip = (page - 1) * ARTICLE_PAGE_SIZE
  const [articles, total] = await Promise.all([
    prisma.seoArticle.findMany({
      where,
      include: { keyword: { select: { text: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: ARTICLE_PAGE_SIZE,
    }),
    prisma.seoArticle.count({ where }),
  ])
  return { articles, total }
}

export async function getArticle(tenantId: string, articleId: string) {
  return prisma.seoArticle.findFirst({
    where: { id: articleId, tenantId },
    include: { keyword: { select: { text: true } } },
  })
}
