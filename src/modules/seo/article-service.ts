import { GoogleGenAI } from '@google/genai'
import { prisma } from '@/lib/db/client'
import type { GenerateArticleInput } from './schemas'
import { fetchOrganicResults } from '@/integrations/serpapi/organic'
import { scrapeCompetitorWordCounts } from '@/integrations/serpapi/scraper'
import type { OrganicResult, RelatedQuestion } from '@/integrations/serpapi/organic'
import type { ScrapedPage } from '@/integrations/serpapi/scraper'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

interface ReaderAnalysis {
  searchIntent: 'informational' | 'navigational' | 'transactional' | 'commercial'
  targetAudience: string
  keyQuestions: string[]    // SERPのPAAや関連検索から抽出した実際の疑問
  painPoints: string[]
  relatedQuestions: string[] // People Also Ask（実データ）
  relatedSearches: string[]  // 関連検索（実データ）
}

interface CompetitorAnalysis {
  recommendedWordCount: number  // 競合平均+20%
  minWordCount: number
  maxWordCount: number
  averageWordCount: number       // 競合平均（実データ）
  reasoning: string
  // 実スクレイプデータ
  scrapedPages: Array<{ url: string; charCount: number; title: string | null }>
  scrapeSuccess: boolean        // スクレイピング成功フラグ
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

/**
 * SERP実データ（PAA・関連検索）を活用して読者ニーズを分析する
 */
async function analyzeReaderNeeds(
  title: string,
  keyword: string | null,
  serpData: {
    relatedQuestions: RelatedQuestion[]
    relatedSearches: string[]
    organicSnippets: string[]
  },
): Promise<ReaderAnalysis> {
  const serpContext = [
    serpData.relatedQuestions.length > 0
      ? `【People Also Ask（実際のユーザーの疑問）】\n${serpData.relatedQuestions.map((q) => `- ${q.question}${q.snippet ? `\n  回答概要: ${q.snippet.slice(0, 100)}` : ''}`).join('\n')}`
      : '',
    serpData.relatedSearches.length > 0
      ? `【関連検索（実際の検索クエリ）】\n${serpData.relatedSearches.map((s) => `- ${s}`).join('\n')}`
      : '',
    serpData.organicSnippets.length > 0
      ? `【上位記事スニペット】\n${serpData.organicSnippets.slice(0, 5).map((s, i) => `${i + 1}位: ${s}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `BtoBマーケティング記事の読者ニーズを分析してください。

タイトル: "${title}"
${keyword ? `ターゲットキーワード: "${keyword}"` : ''}

${serpContext ? `# 検索結果から収集した実データ（これを最優先で活用すること）\n${serpContext}` : ''}

以下のJSON形式のみで回答してください:
{
  "searchIntent": "informational" | "navigational" | "transactional" | "commercial",
  "targetAudience": "想定読者の説明（1文）",
  "keyQuestions": ["読者が知りたいこと1", "読者が知りたいこと2", "読者が知りたいこと3", "読者が知りたいこと4"],
  "painPoints": ["読者の課題1", "読者の課題2", "読者の課題3"],
  "relatedQuestions": ${JSON.stringify(serpData.relatedQuestions.map((q) => q.question).slice(0, 6))},
  "relatedSearches": ${JSON.stringify(serpData.relatedSearches.slice(0, 6))}
}

【注意】relatedQuestions と relatedSearches は上記の実データをそのまま使用してください。
keyQuestions と painPoints はSERP実データを踏まえて深掘りした分析を記述してください。`,
  })
  const text = result.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('読者分析の生成に失敗しました')
  return JSON.parse(match[0]) as ReaderAnalysis
}

/**
 * 競合記事の文字数を実際にスクレイピングして取得する
 * SERPAPI_API_KEY がない場合はAI推定にフォールバック
 */
async function fetchCompetitorWordCounts(
  title: string,
  keyword: string | null,
  organicResults: OrganicResult[],
): Promise<CompetitorAnalysis> {
  // URL一覧があればスクレイピング
  if (organicResults.length > 0) {
    const urls = organicResults.map((r) => r.link)
    const scrapeResult = await scrapeCompetitorWordCounts(urls)

    if (scrapeResult.pages.length > 0) {
      return {
        recommendedWordCount: scrapeResult.recommendedCharCount,
        minWordCount: Math.round(scrapeResult.averageCharCount * 1.1),
        maxWordCount: Math.round(scrapeResult.averageCharCount * 1.5),
        averageWordCount: scrapeResult.averageCharCount,
        reasoning: `上位${scrapeResult.pages.length}記事の平均文字数は${scrapeResult.averageCharCount.toLocaleString()}文字（最小: ${scrapeResult.minCharCount.toLocaleString()}、最大: ${scrapeResult.maxCharCount.toLocaleString()}）。競合を上回るよう${scrapeResult.recommendedCharCount.toLocaleString()}文字以上を目標にします。`,
        scrapedPages: scrapeResult.pages,
        scrapeSuccess: true,
      }
    }
  }

  // フォールバック: AIによる推定
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
  "averageWordCount": 競合平均文字数の推定値（整数）,
  "reasoning": "この文字数を推奨する理由（1〜2文）"
}`,
  })
  const text = result.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('競合分析の生成に失敗しました')
  const parsed = JSON.parse(match[0])
  return {
    ...parsed,
    scrapedPages: [],
    scrapeSuccess: false,
  } as CompetitorAnalysis
}

async function generateHeadingStructure(
  title: string,
  keyword: string | null,
  reader: ReaderAnalysis,
  wordCount: number,
): Promise<HeadingStructure> {
  const serpContext = [
    reader.relatedQuestions.length > 0
      ? `PAA: ${reader.relatedQuestions.join(' / ')}`
      : '',
    reader.relatedSearches.length > 0
      ? `関連検索: ${reader.relatedSearches.join(' / ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `BtoBマーケティング向けSEO記事の見出し構成を設計してください。

タイトル: "${title}"
${keyword ? `ターゲットキーワード: "${keyword}"` : ''}
想定読者: ${reader.targetAudience}
読者の主な疑問: ${reader.keyQuestions.join(' / ')}
読者の課題: ${reader.painPoints.join(' / ')}
目標文字数: ${wordCount}文字
${serpContext ? `\n検索実データ:\n${serpContext}` : ''}

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
- People Also Ask の疑問はH2/H3に自然に組み込む
- 最後のセクションはまとめ・CTAを含める`,
  })
  const text = result.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('見出し構成の生成に失敗しました')
  return JSON.parse(match[0]) as HeadingStructure
}

interface BrandContext {
  tone?: string | null
  companyDescription?: string | null
  ngWords: string[]
  preferredPhrases: Array<{ from: string; to: string }>
}

async function generateArticleDraftContent(
  title: string,
  keyword: string | null,
  reader: ReaderAnalysis,
  competitor: CompetitorAnalysis,
  headings: HeadingStructure,
  ownInsights?: string | null,
  brand?: BrandContext | null,
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

  const TONE_LABELS: Record<string, string> = {
    formal: '丁寧・フォーマル（「〜です・ます」調、信頼感重視）',
    technical: '専門的・技術的（専門用語を積極使用、エンジニア向け）',
    casual: 'カジュアル（親しみやすい表現、読みやすさ重視）',
    friendly: '親近感・対話調（読者に語りかける文体）',
  }

  const brandSection = brand
    ? [
        brand.tone ? `- 文体・トーン: ${TONE_LABELS[brand.tone] ?? brand.tone}` : null,
        brand.companyDescription ? `- 会社・サービス説明（CTAや締めに活用）: ${brand.companyDescription}` : null,
        brand.ngWords.length > 0 ? `- 使用禁止ワード（絶対に使わない）: ${brand.ngWords.join('、')}` : null,
        brand.preferredPhrases.length > 0
          ? `- 言い回しルール:\n${brand.preferredPhrases.map((p) => `  「${p.from}」→「${p.to}」`).join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  const brandConstraintsSection = brandSection
    ? `\n# ブランドガイドライン（必ず遵守）\n${brandSection}\n`
    : ''

  // SERP実データを活用したユーザーニーズセクション
  const serpNeedsSection = [
    reader.relatedQuestions.length > 0
      ? `【実際にユーザーが検索した疑問（People Also Ask）】\n${reader.relatedQuestions.map((q) => `- ${q}`).join('\n')}\n→ これらの疑問に記事内で明確に回答すること`
      : '',
    reader.relatedSearches.length > 0
      ? `【関連検索キーワード（自然に組み込むと加点）】\n${reader.relatedSearches.map((s) => `- ${s}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `以下の条件でBtoBマーケティング向けSEO記事を日本語で執筆してください。
${ownInsightsSection}${brandConstraintsSection}
# 執筆条件
- タイトル: "${title}"
${keyword ? `- ターゲットキーワード: "${keyword}"（自然に3〜5回使用）` : ''}
- 想定読者: ${reader.targetAudience}
- 目標文字数: ${competitor.recommendedWordCount}文字以上（競合平均${competitor.averageWordCount.toLocaleString()}文字を上回ること。最大${competitor.maxWordCount.toLocaleString()}文字）
- 検索意図: ${reader.searchIntent}

# 読者が知りたいこと（分析結果）
${reader.keyQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

# 読者の課題
${reader.painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

${serpNeedsSection ? `# 検索データから判明したユーザーニーズ（必ず対応すること）\n${serpNeedsSection}` : ''}

# 見出し構成（この構成に沿って執筆すること）
# ${headings.h1}

${structureText}

# 品質要件
1. **文字数必達**: 競合平均（${competitor.averageWordCount.toLocaleString()}文字）を上回る${competitor.recommendedWordCount.toLocaleString()}文字以上で執筆。各H2セクションを十分な深さで書くこと
2. **独自性**: ${ownInsights ? '提供された独自情報・事例を最大限活用し、他では読めない内容にする' : '具体的な数字・事例・独自の視点を必ず含める'}
3. **PAA対応**: People Also Ask の疑問に対して明確に回答するセクションを設ける
4. **構造**: 指定の見出し構成（H1/H2/H3）を忠実に使用し、Markdown形式で出力
5. **読みやすさ**: 各段落は3〜5文。箇条書きや表を効果的に使用
6. **専門性**: BtoB企業のマーケティング担当者が「参考になった」と感じる深さで執筆
7. **CTA**: 最後のセクションに自然な形でCTAを含める

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

  // デフォルトプロジェクトを取得
  const project = await prisma.project.findFirst({
    where: { tenantId },
    include: {
      brandProfile: true,
      knowledgeSources: {
        where: { status: 'ready' },
        select: { title: true, category: true, type: true, content: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  const brandProfile = project?.brandProfile ?? null
  const knowledgeSources = project?.knowledgeSources ?? []

  const knowledgeText =
    knowledgeSources.length > 0
      ? knowledgeSources.map((s) => `【${s.title}】\n${s.content ?? ''}`).join('\n\n---\n\n')
      : null

  const combinedInsights =
    [input.ownInsights, knowledgeText].filter(Boolean).join('\n\n---\n\n') || null

  const brand: BrandContext | null = brandProfile
    ? {
        tone: brandProfile.tone,
        companyDescription: brandProfile.companyDescription,
        ngWords: (brandProfile.ngWords as string[]) ?? [],
        preferredPhrases:
          (brandProfile.preferredPhrases as Array<{ from: string; to: string }>) ?? [],
      }
    : null

  // ─── Step 1: SERP実データ取得 ───────────────────────────────────
  // 検索キーワードがある場合は SerpAPI で上位10件を取得
  const searchQuery = keywordText ?? input.title
  const serpApiKey = process.env.SERPAPI_API_KEY

  let organicResults: import('@/integrations/serpapi/organic').OrganicResult[] = []
  let relatedQuestions: RelatedQuestion[] = []
  let relatedSearches: string[] = []
  let organicSnippets: string[] = []

  if (serpApiKey) {
    try {
      const serpData = await fetchOrganicResults(searchQuery, serpApiKey, 10)
      organicResults = serpData.organicResults
      relatedQuestions = serpData.relatedQuestions
      relatedSearches = serpData.relatedSearches
      organicSnippets = serpData.organicResults
        .map((r) => r.snippet)
        .filter((s): s is string => s !== null)
    } catch (err) {
      console.warn('SerpAPI fetch failed, proceeding without SERP data:', err)
    }
  }

  // ─── Step 2 & 3: 読者ニーズ分析 + 競合文字数収集（並列）─────────
  const [reader, competitor] = await Promise.all([
    analyzeReaderNeeds(input.title, keywordText, { relatedQuestions, relatedSearches, organicSnippets }),
    fetchCompetitorWordCounts(input.title, keywordText, organicResults),
  ])

  // ─── Step 4: 見出し構成 ───────────────────────────────────────
  const headings = await generateHeadingStructure(
    input.title,
    keywordText,
    reader,
    competitor.recommendedWordCount,
  )

  // ─── Step 5: 記事本文生成 ─────────────────────────────────────
  const draft = await generateArticleDraftContent(
    input.title,
    keywordText,
    reader,
    competitor,
    headings,
    combinedInsights,
    brand,
  )

  // ─── Step 6: ブリーフ生成 ─────────────────────────────────────
  const competitorPageList =
    competitor.scrapedPages.length > 0
      ? `\n【競合記事文字数（実測）】\n${competitor.scrapedPages
          .map((p, i) => `  ${i + 1}位: ${p.charCount.toLocaleString()}文字 — ${p.title ?? p.url}`)
          .join('\n')}`
      : ''

  const brief = [
    `【検索意図】${reader.searchIntent}`,
    `【想定読者】${reader.targetAudience}`,
    `【読者の疑問】${reader.keyQuestions.join(' / ')}`,
    reader.relatedQuestions.length > 0
      ? `【PAA（実データ）】${reader.relatedQuestions.slice(0, 3).join(' / ')}`
      : '',
    `【競合平均文字数】${competitor.averageWordCount.toLocaleString()}文字（実測${competitor.scrapeSuccess ? '' : 'AI推定'}）`,
    `【目標文字数】${competitor.recommendedWordCount.toLocaleString()}文字以上（競合+20%）`,
    `【競合分析】${competitor.reasoning}`,
    competitorPageList,
  ]
    .filter(Boolean)
    .join('\n')

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
