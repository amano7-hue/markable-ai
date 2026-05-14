import { GoogleGenAI } from '@google/genai'
import OpenAI, { toFile } from 'openai'
import { put, get as getBlob } from '@vercel/blob'
import { prisma } from '@/lib/db/client'
import { inngest } from '@/lib/inngest/client'
import type { GenerateArticleInput } from './schemas'
import { fetchOrganicResults } from '@/integrations/serpapi/organic'
import { scrapeCompetitorWordCounts } from '@/integrations/serpapi/scraper'
import type { OrganicResult, RelatedQuestion } from '@/integrations/serpapi/organic'
import type { ScrapedPage } from '@/integrations/serpapi/scraper'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })
function getOpenAI() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }) }

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

interface SeoMeta {
  seoTitle: string
  seoDescription: string
}

// ─── 比較検討サービス情報 ──────────────────────────────────────────

export interface ComparisonService {
  name: string            // サービス名
  company: string         // 運営会社名
  description: string     // サービス概要（1〜2文）
  url: string             // 公式サイトURL
  features: string[]      // 主な機能・特徴
  pricingNote: string | null // 価格帯メモ
}

/** タイトル・キーワード・検索意図から比較検討記事かどうかを判定 */
function isComparisonArticle(title: string, keyword: string | null, searchIntent: string): boolean {
  const text = `${title} ${keyword ?? ''}`.toLowerCase()
  const terms = ['比較', 'おすすめ', 'ランキング', '選び方', '違い', '比べ', '一覧', 'comparison', 'best', 'top', 'vs']
  return searchIntent === 'commercial' || terms.some((t) => text.includes(t))
}

/**
 * 比較検討記事向けに、実在するサービス・企業を調査して返す
 * SerpAPI で取得した上位記事スニペットをコンテキストとして渡し、
 * Gemini が実際に比較される主要サービスと公式URLを特定する
 */
async function researchComparisonServices(
  title: string,
  keyword: string | null,
  organicResults: OrganicResult[],
  relatedSearches: string[],
): Promise<ComparisonService[]> {
  const serpContext = [
    organicResults.length > 0
      ? `【上位検索結果】\n${organicResults.slice(0, 8).map((r) => `- ${r.title}\n  URL: ${r.link}\n  ${r.snippet ?? ''}`).join('\n')}`
      : '',
    relatedSearches.length > 0
      ? `【関連検索】\n${relatedSearches.slice(0, 8).map((s) => `- ${s}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n')

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    config: { responseMimeType: 'application/json', temperature: 0.3 },
    contents: `以下のSEO記事タイトルと検索データを元に、記事内で比較・紹介すべき主要なサービス・製品を5〜8個特定してください。

記事タイトル: "${title}"
${keyword ? `キーワード: "${keyword}"` : ''}

${serpContext ? `# 検索データ（実際の検索結果）\n${serpContext}` : ''}

---
【重要な指示】
- 検索結果のURLや上位記事に実際に登場するサービスを優先して選ぶ
- 公式サイトURLは正確な実在URLを記載すること（例: salesforce.com, hubspot.com）
- 不明なサービスのURLを推測で記載しない
- 日本市場で実際に利用されているサービスを選ぶ

以下のJSON配列形式のみで出力:
[
  {
    "name": "サービス名",
    "company": "運営会社名",
    "description": "サービスの概要（1〜2文、日本語）",
    "url": "https://official-url.com",
    "features": ["主な機能・特徴1", "特徴2", "特徴3"],
    "pricingNote": "無料プランあり / 月額○○円〜 など（不明なら null）"
  }
]`,
  })

  try {
    const text = result.text ?? ''
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed as ComparisonService[]
  } catch {
    return []
  }
}

async function generateSeoMeta(
  title: string,
  keyword: string | null,
  reader: ReaderAnalysis,
  headings: HeadingStructure,
): Promise<SeoMeta> {
  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `SEO記事のメタ情報を生成してください。

記事タイトル: "${title}"
${keyword ? `ターゲットキーワード: "${keyword}"` : ''}
H1: "${headings.h1}"
想定読者: ${reader.targetAudience}
検索意図: ${reader.searchIntent}
読者の主な疑問: ${reader.keyQuestions.slice(0, 3).join(' / ')}

以下のJSON形式のみで回答してください:
{
  "seoTitle": "SEO用タイトル（必須: キーワードを先頭に配置、全角30文字・半角60文字以内、クリックを誘う表現）",
  "seoDescription": "メタディスクリプション（必須: キーワードを自然に含む、全角120文字・半角150文字以内、記事の価値と行動を促す内容）"
}

【SEO Titleのルール】
- キーワードを冒頭に配置
- 数字・ベネフィット・限定表現を活用（例: 「5つの方法」「完全ガイド」「2024年最新」）
- 全角30文字・半角60文字以内を厳守

【Meta Descriptionのルール】
- 自然な日本語で記事の要点を説明
- キーワードを1〜2回含む
- CTA的な文言で締める（例: 「詳しく解説します」「今すぐ確認」）
- 全角120文字・半角150文字以内を厳守`,
  })
  const text = result.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('SEOメタ情報の生成に失敗しました')
  return JSON.parse(match[0]) as SeoMeta
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
  ctaBlocks?: { shortcode: string; label: string }[],
  comparisonServices?: ComparisonService[],
  trustedSourcesOnly = false,
  additionalInstructions?: string | null,
): Promise<string> {
  const structureText = headings.sections
    .map((s) => `<h2>${s.h2}</h2>\n${s.h3s.map((h) => `<h3>${h}</h3>`).join('\n')}`)
    .join('\n\n')

  const ownInsightsSection = ownInsights
    ? `
# 【最重要】提供された独自情報・事例・調査データ（必ず記事に組み込むこと）
${ownInsights}

上記の独自情報は競合記事との差別化の核心です。以下のルールで組み込んでください：
- 導入事例（case_study）: 具体的な企業名・数字・成果をそのまま本文に引用する
- 調査データ・サービス情報: 根拠として引用し「自社調査によると〜」などの表現で組み込む
- 数字・固有名詞・成果は改変せずそのまま使用する
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

  const ctaSection = ctaBlocks && ctaBlocks.length > 0
    ? `
# CTAショートコード（記事の内容に合ったものを自動選択して挿入すること）
登録されているCTA一覧:
${ctaBlocks.map((b) => `- [cta:${b.shortcode}] — ${b.label}`).join('\n')}

選択・挿入ルール:
- 記事のテーマ・読者の課題・コンバージョン目的に最も合うCTAを選択する
- 複数登録されている場合は、最適な1〜2個を選んで使用する（全部使う必要はない）
- 記事の最後のセクションには必ず1つ挿入する
- 内容的に自然なタイミング（例：問い合わせを促す段落の末尾、まとめの後、資料請求を促す箇所）に配置する
- ショートコードはそのまま [cta:shortcode名] の形式で出力する（HTMLに変換しない）
`
    : ''

  const comparisonSection = comparisonServices && comparisonServices.length > 0
    ? `
# 比較対象サービス一覧（必ず記事に組み込むこと）
以下の各サービスを記事内で紹介してください。

【挿入ルール】
- 各サービス名は必ず <a href="公式URL" target="_blank" rel="noopener noreferrer">サービス名</a> 形式でリンクを付ける
- 比較セクション（H2またはH3）でサービスごとに1〜2段落で紹介する
- 可能であれば比較表（<table>）に主要な特徴・価格帯をまとめる
- 記事の文脈に合わせて自然に言及し、ステマ的にならないよう客観的な表現を使う

【比較対象サービス】
${comparisonServices.map((s) => [
  `● ${s.name}（${s.company}）`,
  `  公式URL: ${s.url}`,
  `  概要: ${s.description}`,
  `  特徴: ${s.features.join(' / ')}`,
  s.pricingNote ? `  価格: ${s.pricingNote}` : '',
].filter(Boolean).join('\n')).join('\n\n')}
`
    : ''

  const citationSection = trustedSourcesOnly
    ? `
# 参照元ルール（必ず遵守）【信頼性の高いソースのみ使用】
- 統計データ・数値・事実を引用する場合は、以下の種類の公式ソースからのみ引用してください:
  - 政府機関・官公庁（経済産業省、総務省、国土交通省、.go.jp ドメイン等）
  - 国際機関（WHO、UN、OECD、World Bank 等）
  - 主要調査機関・大学・研究機関（.ac.jp、McKinsey、Gartner、IDC 等）
  - 東証プライム上場企業・Fortune 500 企業の公式発表・IR資料
- 個人ブログ・まとめサイト・出典不明の情報は絶対に使用しない
- すべての統計・データには出典を本文中に <sup class="ref">[番号]</sup> 形式で付記すること
- 記事末尾に <section id="references" class="references-section"><h2>参考文献</h2><ol> ... </ol></section> を追加し、参照元のタイトル・機関名・URL・発行年を列挙すること
`
    : `
# 参照元ルール
- 統計データ・数値・事実を引用する場合は、必ず出典を明記してください
- 本文中に <sup class="ref">[番号]</sup> 形式で脚注番号を付け、記事末尾に参考文献リストを追加してください
- 参考文献: <section id="references" class="references-section"><h2>参考文献</h2><ol><li>出典タイトル — 機関名（URL / 発行年）</li></ol></section>
`

  const additionalInstructionsSection = additionalInstructions
    ? `\n# 追加指示（最優先で反映すること）\n${additionalInstructions}\n`
    : ''

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `以下の条件でBtoBマーケティング向けSEO記事を日本語で執筆してください。
${additionalInstructionsSection}${ownInsightsSection}${brandConstraintsSection}${ctaSection}${comparisonSection}${citationSection}
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
<h1>${headings.h1}</h1>

${structureText}

# 出力フォーマット（厳守）
- 見出しは必ず <h1>〜</h3> タグを使用する（# ## ### の Markdown は使用禁止）
- 本文の段落は <p> タグで囲む
- 箇条書きは <ul><li>〜</li></ul>、番号付きリストは <ol><li>〜</li></ol>
- **太字** や *斜体* などの Markdown 記法は使用禁止。太字は <strong>、斜体は <em>
- 重要な数字・キーワードには <u> でアンダーライン: <u>重要テキスト</u>
- 特に注目させたい語句は <mark> でハイライト: <mark>注目ポイント</mark>
- 警告・注意事項は <span class="text-amber-600">⚠️ 注意：内容</span>
- 上記の装飾は多用せず、記事全体で各5〜8箇所程度に絞ること
- コロン（:）で始まるラベル行・ナンバリング（1. 2. 3.）は使用しない
- CTAショートコードは [cta:shortcode名] の形式でそのまま出力する

# 品質要件
1. 文字数必達: 競合平均（${competitor.averageWordCount.toLocaleString()}文字）を上回る${competitor.recommendedWordCount.toLocaleString()}文字以上で執筆
2. 独自性: ${ownInsights ? '提供された独自情報・導入事例・調査データを各セクションに具体的に組み込む' : '具体的な数字・事例・独自の視点を必ず含める'}
3. PAA対応: People Also Ask の疑問に対して明確に回答するセクションを設ける
4. 読みやすさ: 各段落は3〜5文。箇条書きや表を効果的に使用
5. 専門性: BtoB企業のマーケティング担当者が「参考になった」と感じる深さで執筆

記事本文のみを出力してください（前置きや説明文は不要）。`,
  })
  return result.text ?? ''
}

/**
 * 記事分析フェーズ（Step 1〜4）のみ実行する。
 * 結果をユーザーが確認・編集した上で generateArticleDraft に渡す。
 */
export async function analyzeArticle(
  keyword: string,
  title: string,
): Promise<{ reader: ReaderAnalysis; competitor: CompetitorAnalysis; headings: HeadingStructure }> {
  const serpApiKey = process.env.SERPAPI_API_KEY
  let organicResults: OrganicResult[] = []
  let relatedQuestions: RelatedQuestion[] = []
  let relatedSearches: string[] = []
  let organicSnippets: string[] = []

  if (serpApiKey) {
    try {
      const serpData = await fetchOrganicResults(keyword || title, serpApiKey, 10)
      organicResults = serpData.organicResults
      relatedQuestions = serpData.relatedQuestions
      relatedSearches = serpData.relatedSearches
      organicSnippets = serpData.organicResults.map((r) => r.snippet).filter((s): s is string => s !== null)
    } catch (err) {
      console.warn('SerpAPI fetch failed in analyzeArticle:', err)
    }
  }

  const [reader, competitor] = await Promise.all([
    analyzeReaderNeeds(title, keyword || null, { relatedQuestions, relatedSearches, organicSnippets }),
    fetchCompetitorWordCounts(title, keyword || null, organicResults),
  ])

  const headings = await generateHeadingStructure(title, keyword || null, reader, competitor.recommendedWordCount)

  return { reader, competitor, headings }
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
  } else if (input.keywordText) {
    keywordText = input.keywordText
  }

  // プロジェクトを厳密に1つに特定する。特定できない場合はエラー（クロスプロジェクト汚染を防止）
  const knowledgeInclude = {
    brandProfile: true,
    knowledgeSources: {
      where: { status: 'ready', isActive: true },
      select: { title: true, category: true, type: true, content: true },
      orderBy: { createdAt: 'desc' },
    },
  } as const

  const resolvedProject = await (async () => {
    if (input.projectId) {
      // projectId が指定された場合: そのプロジェクトだけを使用（他プロジェクトへのフォールバックなし）
      return prisma.project.findFirst({
        where: { id: input.projectId, tenantId },
        include: knowledgeInclude,
      })
    }
    // 未指定の場合: デフォルトプロジェクト → 最初のプロジェクト（テナントに必ず1つ以上存在する前提）
    return (
      await prisma.project.findFirst({
        where: { tenantId, isDefault: true },
        include: knowledgeInclude,
      })
    ) ?? prisma.project.findFirst({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: knowledgeInclude,
    })
  })()

  if (!resolvedProject) {
    throw new Error(
      input.projectId
        ? `プロジェクトが見つかりません (id: ${input.projectId})`
        : 'テナントにプロジェクトが存在しません',
    )
  }

  const resolvedProjectId = resolvedProject.id

  const ctaBlocks = await prisma.ctaBlock.findMany({
    where: { tenantId, projectId: resolvedProjectId, isActive: true },
    select: { shortcode: true, label: true },
    orderBy: { createdAt: 'asc' },
  })

  const project = resolvedProject

  const brandProfile = project.brandProfile ?? null
  const knowledgeSources = project?.knowledgeSources ?? []

  // カテゴリ別に整理して AI が活用しやすくする
  const CATEGORY_LABELS: Record<string, string> = {
    case_study: '導入事例',
    service: 'サービス情報',
    company: '会社情報',
    other: 'その他情報',
  }

  const knowledgeText =
    knowledgeSources.length > 0
      ? knowledgeSources
          .map((s) => `【${CATEGORY_LABELS[s.category] ?? s.category}: ${s.title}】\n${s.content ?? ''}`)
          .join('\n\n---\n\n')
      : null

  const combinedInsights =
    [input.ownInsights, knowledgeText].filter(Boolean).join('\n\n---\n\n') || null

  const ctaBlocksForPrompt = ctaBlocks

  const brand: BrandContext | null = brandProfile
    ? {
        tone: brandProfile.tone,
        companyDescription: brandProfile.companyDescription,
        ngWords: (brandProfile.ngWords as string[]) ?? [],
        preferredPhrases:
          (brandProfile.preferredPhrases as Array<{ from: string; to: string }>) ?? [],
      }
    : null

  // ─── Step 1-3: SERP取得 + 読者ニーズ分析 + 競合文字数収集 ─────────
  // 分析フェーズ（analyzeArticle）の結果が渡された場合は再計算をスキップ
  let organicResults: import('@/integrations/serpapi/organic').OrganicResult[] = []
  let relatedSearches: string[] = []
  let readerRaw: ReaderAnalysis
  let competitor: CompetitorAnalysis

  if (input.precomputedReader && input.precomputedCompetitor) {
    // 事前計算済みデータを使用（SERP + AI分析をスキップ、約60-80秒の節約）
    readerRaw = {
      ...input.precomputedReader,
      relatedQuestions: input.precomputedReader.relatedQuestions ?? [],
      relatedSearches: input.precomputedReader.relatedSearches ?? [],
    }
    competitor = {
      ...input.precomputedCompetitor,
      scrapedPages: input.precomputedCompetitor.scrapedPages ?? [],
      scrapeSuccess: input.precomputedCompetitor.scrapeSuccess ?? false,
    }
    relatedSearches = input.precomputedReader.relatedSearches ?? []
  } else {
    // 事前計算なし: SERP取得 + AI分析を実行
    const searchQuery = keywordText ?? input.title
    const serpApiKey = process.env.SERPAPI_API_KEY
    let relatedQuestions: RelatedQuestion[] = []
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

    const [rRaw, comp] = await Promise.all([
      analyzeReaderNeeds(input.title, keywordText, { relatedQuestions, relatedSearches, organicSnippets }),
      fetchCompetitorWordCounts(input.title, keywordText, organicResults),
    ])
    readerRaw = rRaw
    competitor = comp
  }

  // ペルソナが手動入力された場合は上書き
  const reader: ReaderAnalysis = input.persona
    ? { ...readerRaw, targetAudience: input.persona }
    : readerRaw

  // ─── Step 3b: 比較検討記事の場合はサービスリサーチ ──────────────
  let comparisonServices: ComparisonService[] = []
  if (isComparisonArticle(input.title, keywordText, reader.searchIntent)) {
    try {
      comparisonServices = await researchComparisonServices(
        input.title,
        keywordText,
        organicResults,
        relatedSearches,
      )
      if (comparisonServices.length > 0) {
        console.log(`比較サービス ${comparisonServices.length} 件を調査しました`)
      }
    } catch (err) {
      console.warn('比較サービスリサーチに失敗しました:', err)
    }
  }

  // ─── Step 4: 見出し構成 ───────────────────────────────────────
  // カスタム見出し構成が渡された場合はそのまま使用
  const headings: HeadingStructure = input.customHeadings
    ? input.customHeadings
    : await generateHeadingStructure(input.title, keywordText, reader, competitor.recommendedWordCount)

  // ─── Step 4b: SEO Title & Meta Description ────────────────────
  const seoMeta = await generateSeoMeta(input.title, keywordText, reader, headings)

  // ─── Step 5: 記事本文生成 ─────────────────────────────────────
  const draft = await generateArticleDraftContent(
    input.title,
    keywordText,
    reader,
    competitor,
    headings,
    combinedInsights,
    brand,
    ctaBlocksForPrompt,
    comparisonServices.length > 0 ? comparisonServices : undefined,
    input.trustedSourcesOnly ?? false,
  )

  // ─── Step 7 & 8: 図解・テーブル構造生成（並列、テキストのみ）────
  // DALL-E 3 画像生成は Inngest バックグラウンドジョブに委譲する
  const [diagramResult, tableResult] = await Promise.allSettled([
    generateDiagrams(
      draft, input.title, keywordText,
      brandProfile?.diagramPreference as string | null ?? null,
      brandProfile?.diagramInstructions as string | null ?? null,
    ),
    generateTables(draft, input.title, keywordText),
  ])

  const diagramSpecs = diagramResult.status === 'fulfilled' ? diagramResult.value.specs : []
  const tableSpecs = tableResult.status === 'fulfilled' ? tableResult.value.specs : []

  // 図解・テーブルのマーカーを元の draft に重複なく挿入
  let finalDraft = draft
  for (const spec of diagramSpecs) {
    const regex = new RegExp(`(<h2[^>]*>[^<]*${escapeRegex(spec.insertAfterH2)}[^<]*</h2>)`, 'i')
    finalDraft = finalDraft.replace(regex, `$1\n[diagram:${spec.marker}]`)
  }
  for (const spec of tableSpecs) {
    const regex = new RegExp(`(<h2[^>]*>[^<]*${escapeRegex(spec.insertAfterH2)}[^<]*</h2>)`, 'i')
    finalDraft = finalDraft.replace(regex, `$1\n[table:${spec.marker}]`)
  }

  // ─── Step 6: ブリーフ生成 ─────────────────────────────────────
  const competitorPageList =
    competitor.scrapedPages.length > 0
      ? `\n【競合記事文字数（実測）】\n${competitor.scrapedPages
          .map((p, i) => `  ${i + 1}位: ${p.charCount.toLocaleString()}文字 — ${p.title ?? p.url}`)
          .join('\n')}`
      : ''

  const comparisonServicesLine =
    comparisonServices.length > 0
      ? `【比較対象サービス】${comparisonServices.map((s) => `${s.name}（${s.url}）`).join(' / ')}`
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
    comparisonServicesLine,
  ]
    .filter(Boolean)
    .join('\n')

  const analysis: ArticleAnalysis & { comparisonServices?: ComparisonService[] } = {
    reader,
    competitor,
    headings,
    ...(comparisonServices.length > 0 ? { comparisonServices } : {}),
  }

  // ─── アイキャッチ画像: SVGを即時生成 → AI生成はInngestで後から上書き ───
  const featuredImageUrl = generateFeaturedImageSvg(input.title, keywordText)

  const article = await prisma.seoArticle.create({
    data: {
      tenantId,
      projectId: resolvedProjectId,
      keywordId: input.keywordId ?? null,
      title: input.title,
      analysis,
      brief,
      draft: finalDraft,
      seoTitle: seoMeta.seoTitle,
      seoDescription: seoMeta.seoDescription,
      featuredImageUrl: featuredImageUrl ?? undefined,
    },
  })

  // 図解・テーブルレコードを一括挿入（図解画像は Inngest が後から更新）
  await Promise.all([
    diagramSpecs.length > 0
      ? prisma.seoArticleDiagram.createMany({
          data: diagramSpecs.map((s) => ({
            tenantId,
            articleId: article.id,
            marker: s.marker,
            title: s.title,
            mermaidCode: s.mermaidCode,
          })),
        })
      : Promise.resolve(),
    tableSpecs.length > 0
      ? prisma.seoArticleTable.createMany({
          data: tableSpecs.map((s) => ({
            tenantId,
            articleId: article.id,
            marker: s.marker,
            title: s.title,
            htmlContent: s.htmlContent,
          })),
        })
      : Promise.resolve(),
  ])

  // ─── 図解画像・AI版アイキャッチを Inngest バックグラウンドジョブに委譲 ──
  await inngest.send({
    name: 'seo/article.images.requested',
    data: {
      articleId: article.id,
      tenantId,
      diagramSpecs: diagramSpecs.map((s) => ({
        marker: s.marker,
        title: s.title,
        mermaidCode: s.mermaidCode,
        imagePrompt: s.imagePrompt,
      })),
      featuredImage: {
        title: input.title,
        keyword: keywordText,
        brandDescription: brandProfile?.companyDescription ?? null,
        imageStyleInstructions: (brandProfile?.imageStyleInstructions as string | null) ?? null,
        referenceImageUrl: (brandProfile?.referenceImageUrl as string | null) ?? null,
      },
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
        seoTitle: seoMeta.seoTitle,
        seoDescription: seoMeta.seoDescription,
        brief,
        draft: finalDraft,
        analysis,
        generatedAt: new Date().toISOString(),
      },
    },
  })

  return { articleId: article.id, approvalItemId: approvalItem.id }
}

/**
 * 既存の記事を再生成する。
 * 保存済みの分析データ（reader / competitor / headings）を再利用し、
 * ドラフト・図解・テーブル・アイキャッチを差し替える。
 * additionalInstructions があればドラフト生成プロンプトに追加指示として注入する。
 */
export async function regenerateArticle(
  tenantId: string,
  articleId: string,
  additionalInstructions?: string | null,
): Promise<void> {
  const existing = await prisma.seoArticle.findFirst({
    where: { id: articleId, tenantId },
    select: { id: true, title: true, keywordId: true, projectId: true, analysis: true },
  })
  if (!existing) throw new Error('記事が見つかりません')

  // キーワードテキストを取得
  let keywordText: string | null = null
  if (existing.keywordId) {
    const kw = await prisma.seoKeyword.findFirst({
      where: { id: existing.keywordId, tenantId },
      select: { text: true },
    })
    keywordText = kw?.text ?? null
  }

  // プロジェクト・ブランド・ナレッジ・CTAを解決
  const knowledgeInclude = {
    brandProfile: true,
    knowledgeSources: {
      where: { status: 'ready', isActive: true },
      select: { title: true, category: true, type: true, content: true },
      orderBy: { createdAt: 'desc' },
    },
  } as const

  const project = await prisma.project.findFirst({
    where: { id: existing.projectId!, tenantId },
    include: knowledgeInclude,
  })
  if (!project) throw new Error('プロジェクトが見つかりません')

  const ctaBlocks = await prisma.ctaBlock.findMany({
    where: { tenantId, projectId: project.id, isActive: true },
    select: { shortcode: true, label: true },
    orderBy: { createdAt: 'asc' },
  })

  const brandProfile = project.brandProfile ?? null
  const knowledgeSources = project.knowledgeSources ?? []
  const CATEGORY_LABELS: Record<string, string> = {
    case_study: '導入事例', service: 'サービス情報', company: '会社情報', other: 'その他情報',
  }
  const knowledgeText =
    knowledgeSources.length > 0
      ? knowledgeSources
          .map((s) => `【${CATEGORY_LABELS[s.category] ?? s.category}: ${s.title}】\n${s.content ?? ''}`)
          .join('\n\n---\n\n')
      : null

  const brand: BrandContext | null = brandProfile
    ? {
        tone: brandProfile.tone,
        companyDescription: brandProfile.companyDescription,
        ngWords: (brandProfile.ngWords as string[]) ?? [],
        preferredPhrases: (brandProfile.preferredPhrases as Array<{ from: string; to: string }>) ?? [],
      }
    : null

  // 保存済み分析データを再利用（なければ再生成）
  const storedAnalysis = existing.analysis as (ArticleAnalysis & { comparisonServices?: ComparisonService[] }) | null

  let reader: ReaderAnalysis
  let competitor: CompetitorAnalysis
  let headings: HeadingStructure
  let comparisonServices: ComparisonService[] = []

  if (storedAnalysis?.reader && storedAnalysis?.competitor && storedAnalysis?.headings) {
    reader = storedAnalysis.reader
    competitor = storedAnalysis.competitor
    headings = storedAnalysis.headings
    comparisonServices = storedAnalysis.comparisonServices ?? []
  } else {
    // 分析データがなければ SERP から再取得
    const serpApiKey = process.env.SERPAPI_API_KEY
    let organicResults: OrganicResult[] = []
    let relatedQuestions: RelatedQuestion[] = []
    let relatedSearches: string[] = []
    let organicSnippets: string[] = []

    if (serpApiKey) {
      try {
        const serpData = await fetchOrganicResults(keywordText ?? existing.title, serpApiKey, 10)
        organicResults = serpData.organicResults
        relatedQuestions = serpData.relatedQuestions
        relatedSearches = serpData.relatedSearches
        organicSnippets = serpData.organicResults.map((r) => r.snippet).filter((s): s is string => s !== null)
      } catch (err) {
        console.warn('SerpAPI fetch failed in regenerateArticle:', err)
      }
    }

    const [readerRaw, comp] = await Promise.all([
      analyzeReaderNeeds(existing.title, keywordText, { relatedQuestions, relatedSearches, organicSnippets }),
      fetchCompetitorWordCounts(existing.title, keywordText, organicResults),
    ])
    reader = readerRaw
    competitor = comp
    headings = await generateHeadingStructure(existing.title, keywordText, reader, competitor.recommendedWordCount)
  }

  // ドラフト再生成
  const draft = await generateArticleDraftContent(
    existing.title,
    keywordText,
    reader,
    competitor,
    headings,
    knowledgeText,
    brand,
    ctaBlocks,
    comparisonServices.length > 0 ? comparisonServices : undefined,
    false,
    additionalInstructions,
  )

  // 図解・テーブル再生成（並列）
  const [diagramResult, tableResult] = await Promise.allSettled([
    generateDiagrams(
      draft, existing.title, keywordText,
      brandProfile?.diagramPreference as string | null ?? null,
      brandProfile?.diagramInstructions as string | null ?? null,
    ),
    generateTables(draft, existing.title, keywordText),
  ])

  const diagramSpecs = diagramResult.status === 'fulfilled' ? diagramResult.value.specs : []
  const tableSpecs = tableResult.status === 'fulfilled' ? tableResult.value.specs : []

  let finalDraft = draft
  for (const spec of diagramSpecs) {
    const regex = new RegExp(`(<h2[^>]*>[^<]*${escapeRegex(spec.insertAfterH2)}[^<]*</h2>)`, 'i')
    finalDraft = finalDraft.replace(regex, `$1\n[diagram:${spec.marker}]`)
  }
  for (const spec of tableSpecs) {
    const regex = new RegExp(`(<h2[^>]*>[^<]*${escapeRegex(spec.insertAfterH2)}[^<]*</h2>)`, 'i')
    finalDraft = finalDraft.replace(regex, `$1\n[table:${spec.marker}]`)
  }

  // SEOメタ再生成（失敗しても記事本体の保存はブロックしない）
  let seoMeta: SeoMeta = { seoTitle: existing.title, seoDescription: '' }
  try {
    seoMeta = await generateSeoMeta(existing.title, keywordText, reader, headings)
  } catch (err) {
    console.warn('[regenerateArticle] generateSeoMeta failed, using fallback:', err instanceof Error ? err.message : err)
  }

  // ブリーフ再生成
  const brief = [
    `【検索意図】${reader.searchIntent}`,
    `【想定読者】${reader.targetAudience}`,
    `【読者の疑問】${reader.keyQuestions.join(' / ')}`,
    reader.relatedQuestions.length > 0
      ? `【PAA（実データ）】${reader.relatedQuestions.slice(0, 3).join(' / ')}`
      : '',
    `【競合平均文字数】${competitor.averageWordCount.toLocaleString()}文字`,
    `【目標文字数】${competitor.recommendedWordCount.toLocaleString()}文字以上`,
    additionalInstructions ? `【追加指示】${additionalInstructions}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  // アイキャッチ再生成: SVGを即時生成 → AI生成はInngestで後から上書き
  const featuredImageUrl = generateFeaturedImageSvg(existing.title, keywordText)

  const newAnalysis: ArticleAnalysis & { comparisonServices?: ComparisonService[] } = {
    reader,
    competitor,
    headings,
    ...(comparisonServices.length > 0 ? { comparisonServices } : {}),
  }

  // 既存の図解・テーブルを削除して記事を更新
  await prisma.seoArticleDiagram.deleteMany({ where: { articleId, tenantId } })
  await prisma.seoArticleTable.deleteMany({ where: { articleId, tenantId } })

  await prisma.seoArticle.update({
    where: { id: articleId, tenantId },
    data: {
      analysis: newAnalysis,
      brief,
      draft: finalDraft,
      seoTitle: seoMeta.seoTitle,
      seoDescription: seoMeta.seoDescription,
      featuredImageUrl: featuredImageUrl ?? undefined,
      status: 'PENDING',
    },
  })

  await Promise.all([
    diagramSpecs.length > 0
      ? prisma.seoArticleDiagram.createMany({
          data: diagramSpecs.map((s) => ({
            tenantId,
            articleId,
            marker: s.marker,
            title: s.title,
            mermaidCode: s.mermaidCode,
          })),
        })
      : Promise.resolve(),
    tableSpecs.length > 0
      ? prisma.seoArticleTable.createMany({
          data: tableSpecs.map((s) => ({
            tenantId,
            articleId,
            marker: s.marker,
            title: s.title,
            htmlContent: s.htmlContent,
          })),
        })
      : Promise.resolve(),
  ])

  // 図解画像・AI版アイキャッチを Inngest バックグラウンドジョブに委譲
  await inngest.send({
    name: 'seo/article.images.requested',
    data: {
      articleId,
      tenantId,
      diagramSpecs: diagramSpecs.map((s) => ({
        marker: s.marker,
        title: s.title,
        mermaidCode: s.mermaidCode,
        imagePrompt: s.imagePrompt,
      })),
      featuredImage: {
        title: existing.title,
        keyword: keywordText,
        brandDescription: brandProfile?.companyDescription ?? null,
        imageStyleInstructions: (brandProfile?.imageStyleInstructions as string | null) ?? null,
        referenceImageUrl: (brandProfile?.referenceImageUrl as string | null) ?? null,
      },
    },
  })

  // 承認アイテムを PENDING に戻す
  await prisma.approvalItem.updateMany({
    where: { tenantId, module: 'seo', type: 'seo_article_draft' },
    data: { status: 'PENDING' },
  })
}

// ─── アイキャッチ画像生成 ────────────────────────────────────────

/** SVGフォールバックのdata URLを同期生成（API呼び出しなし・常に成功） */
export function generateFeaturedImageSvg(title: string, keyword: string | null): string | null {
  try {
    const svgBuffer = generateFeaturedSvg(title, keyword)
    return `data:image/svg+xml;base64,${svgBuffer.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Vercel Blob のプライベートURLから画像を取得する。
 * Vercel Blob SDK の get() を使用してサーバー側で認証アクセスする。
 */
async function fetchPrivateBlob(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const result = await getBlob(url, { access: 'private' })
    if (!result || result.statusCode !== 200) {
      console.warn(`[fetchPrivateBlob] get() returned ${result?.statusCode ?? 'null'}: ${url}`)
      return null
    }
    // ReadableStream → Buffer → base64
    const reader = result.stream.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    const base64 = buffer.toString('base64')
    const mimeType = result.blob.contentType ?? 'image/jpeg'
    return { base64, mimeType }
  } catch (e) {
    console.warn('[fetchPrivateBlob] error:', e)
    return null
  }
}

/**
 * 参照画像のビジュアルスタイルを Gemini で分析し、テキスト記述として返す。
 * この記述を画像生成プロンプトに注入することで、モデルに依存しないスタイル転写を実現する。
 */
async function analyzeReferenceImageStyle(base64: string, mimeType: string): Promise<string> {
  try {
    const res = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: `Analyze this design image and produce a detailed visual style specification for recreation. Describe:
1. Color palette (list primary, secondary, accent colors with approximate hex values)
2. Background style (solid, gradient, pattern, texture)
3. Typography (font weight, size, style)
4. Layout and composition (where elements are placed, alignment, spacing)
5. Graphic elements (icons, shapes, lines, decorative elements)
6. Overall mood and tone (professional, playful, minimal, bold, etc.)
7. Any distinctive design patterns or motifs

Be extremely specific. Output should be a detailed description that allows recreating this exact visual style.` }
        ]
      }]
    })
    return res.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  } catch (e) {
    console.warn('[analyzeReferenceImageStyle] failed:', e)
    return ''
  }
}

/**
 * 画像を生成して Vercel Blob に保存する共通ヘルパー。
 *
 * ① gpt-image-1 images.edit（参照画像あり — スタイル転写）
 * ② gpt-image-1 images.generate（参照画像なし、またはedit失敗時のフォールバック）
 */
export async function generateImageWithGemini(
  prompt: string,
  blobPath: string,
  referenceImageUrl?: string | null,
  size: '1536x1024' | '1024x1024' | '1024x1536' = '1536x1024',
): Promise<string | null> {
  // 参照画像を取得（Vercel Blob SDK で認証アクセス）
  let refBase64: string | null = null
  let refMime = 'image/jpeg'
  let styleDescription = ''

  if (referenceImageUrl) {
    const fetched = await fetchPrivateBlob(referenceImageUrl)
    if (fetched) {
      refBase64 = fetched.base64
      refMime = fetched.mimeType
      styleDescription = await analyzeReferenceImageStyle(refBase64, refMime)
      console.log('[generateImageWithGemini] reference image fetched, style analyzed')
    } else {
      console.warn('[generateImageWithGemini] reference image fetch failed:', referenceImageUrl)
    }
  }

  const styledPrompt = styleDescription
    ? `${prompt}\n\nVISUAL STYLE REQUIREMENTS (reproduce this design language exactly):\n${styleDescription}\n\nGenerate completely new content for the topic above, but use the EXACT same visual design language described.`
    : prompt

  const openai = getOpenAI()

  // b64_jsonをBufferに変換（data:...プレフィックスがある場合は除去）
  function b64ToBuffer(b64: string): Buffer {
    const raw = b64.includes(',') ? b64.split(',')[1] : b64
    return Buffer.from(raw, 'base64')
  }

  // ① gpt-image-1 images.edit（参照画像ありの場合 — スタイル転写）
  if (refBase64) {
    try {
      const imageFile = await toFile(
        Buffer.from(refBase64, 'base64'),
        'reference.jpg',
        { type: refMime },
      )
      const res = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFile,
        prompt: `${styledPrompt}\n\nIMPORTANT: Keep the exact same visual design style, color palette, typography, and layout from the reference image. Only change the subject matter and content to match the topic.`,
        input_fidelity: 'high',
        n: 1,
        size,
      })
      const b64 = res.data?.[0]?.b64_json
      console.log('[generateImageWithGemini] gpt-image-1 edit b64 length:', b64?.length ?? 0)
      if (b64) {
        const buffer = b64ToBuffer(b64)
        console.log('[generateImageWithGemini] gpt-image-1 edit buffer size:', buffer.length)
        const blob = await put(`${blobPath}.png`, buffer, { access: 'private', contentType: 'image/png' })
        console.log('Image generated with gpt-image-1 edit (style transfer):', blob.url)
        return blob.url
      }
    } catch (err) {
      console.warn('gpt-image-1 edit failed:', err instanceof Error ? err.message : err)
    }
  }

  // ② gpt-image-1 images.generate（参照画像なし、またはedit失敗時のフォールバック）
  try {
    const genSize = size === '1024x1024' ? '1024x1024' : size === '1024x1536' ? '1024x1536' : '1536x1024'
    const res = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: styledPrompt,
      n: 1,
      size: genSize,
    })
    const b64 = res.data?.[0]?.b64_json
    console.log('[generateImageWithGemini] gpt-image-1 generate b64 length:', b64?.length ?? 0)
    if (b64) {
      const buffer = b64ToBuffer(b64)
      console.log('[generateImageWithGemini] gpt-image-1 generate buffer size:', buffer.length)
      const blob = await put(`${blobPath}.png`, buffer, { access: 'private', contentType: 'image/png' })
      console.log('Image generated with gpt-image-1 generate:', blob.url)
      return blob.url
    }
  } catch (err) {
    console.warn('gpt-image-1 generate failed:', err instanceof Error ? err.message : err)
  }

  console.error('[generateImageWithGemini] All methods failed')
  return null
}

/** SVGからブランデッドアイキャッチ画像を生成（外部APIなし・常に成功） */
function generateFeaturedSvg(title: string, keyword: string | null): Buffer {
  // タイトルを複数行に分割（1行あたり最大20文字）
  const chars = title.split('')
  const lines: string[] = []
  let current = ''
  for (const ch of chars) {
    current += ch
    if (current.length >= 20 && (ch === '　' || ch === ' ' || ch === '、' || ch === '。' || current.length >= 24)) {
      lines.push(current.trim())
      current = ''
    }
  }
  if (current.trim()) lines.push(current.trim())
  const displayLines = lines.slice(0, 3)

  const lineHeight = 74
  const titleCenterY = 290
  const startY = titleCenterY - ((displayLines.length - 1) * lineHeight) / 2
  const textElements = displayLines.map((line, i) =>
    `<text x="600" y="${startY + i * lineHeight}" font-family="'Hiragino Sans','Yu Gothic','Meiryo','Noto Sans JP',sans-serif" font-size="56" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle" filter="url(#textGlow)">${escapeXml(line)}</text>`
  ).join('\n  ')

  const kwLabel = keyword ? escapeXml(keyword) : ''
  const kwWidth = kwLabel ? Math.min(kwLabel.length * 17 + 48, 440) : 0
  const kwX = kwLabel ? 600 - kwWidth / 2 : 0
  const kwBadge = kwLabel
    ? `<rect x="${kwX}" y="${startY + displayLines.length * lineHeight + 20}" width="${kwWidth}" height="38" rx="19" fill="rgba(129,140,248,0.18)" stroke="rgba(129,140,248,0.4)" stroke-width="1"/>
  <text x="600" y="${startY + displayLines.length * lineHeight + 39}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16" fill="rgba(196,200,255,0.9)" text-anchor="middle" dominant-baseline="middle" letter-spacing="0.3">${kwLabel}</text>`
    : ''

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#060c1f"/>
      <stop offset="100%" stop-color="#0c1a3a"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <filter id="textGlow" x="-10%" y="-30%" width="120%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="bounds"><rect width="1200" height="630"/></clipPath>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Atmospheric glow -->
  <circle cx="1160" cy="80"  r="320" fill="#4f46e5" opacity="0.07" clip-path="url(#bounds)"/>
  <circle cx="40"   cy="580" r="260" fill="#6366f1" opacity="0.06" clip-path="url(#bounds)"/>
  <circle cx="600"  cy="315" r="380" fill="#1d4ed8" opacity="0.04" clip-path="url(#bounds)"/>

  <!-- Top-right corner polygon -->
  <polygon points="1060,0 1200,0 1200,200" fill="rgba(99,102,241,0.07)"/>
  <polygon points="1130,0 1200,0 1200,90"  fill="rgba(99,102,241,0.06)"/>

  <!-- Network nodes: top-right -->
  <line x1="880" y1="65"  x2="960" y2="130" stroke="rgba(129,140,248,0.28)" stroke-width="1.5"/>
  <line x1="960" y1="130" x2="1055" y2="95" stroke="rgba(99,102,241,0.22)"  stroke-width="1.2"/>
  <line x1="1055" y1="95" x2="1105" y2="185" stroke="rgba(129,140,248,0.2)" stroke-width="1"/>
  <line x1="960"  y1="130" x2="1010" y2="210" stroke="rgba(59,130,246,0.18)" stroke-width="1"/>
  <circle cx="880"  cy="65"  r="4"   fill="rgba(129,140,248,0.55)"/>
  <circle cx="960"  cy="130" r="6.5" fill="rgba(99,102,241,0.65)"/>
  <circle cx="1055" cy="95"  r="3.5" fill="rgba(59,130,246,0.55)"/>
  <circle cx="1105" cy="185" r="3"   fill="rgba(129,140,248,0.45)"/>
  <circle cx="1010" cy="210" r="4.5" fill="rgba(99,102,241,0.5)"/>

  <!-- Network nodes: bottom-left -->
  <line x1="90"  y1="420" x2="170" y2="480" stroke="rgba(129,140,248,0.22)" stroke-width="1.2"/>
  <line x1="170" y1="480" x2="110" y2="550" stroke="rgba(99,102,241,0.18)"  stroke-width="1"/>
  <line x1="170" y1="480" x2="255" y2="505" stroke="rgba(59,130,246,0.16)"  stroke-width="1"/>
  <circle cx="90"  cy="420" r="3.5" fill="rgba(129,140,248,0.45)"/>
  <circle cx="170" cy="480" r="5.5" fill="rgba(99,102,241,0.55)"/>
  <circle cx="110" cy="550" r="3"   fill="rgba(59,130,246,0.4)"/>
  <circle cx="255" cy="505" r="3.5" fill="rgba(129,140,248,0.4)"/>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="5" height="630" fill="url(#barGrad)"/>

  <!-- Category label -->
  <rect x="80" y="146" width="10" height="10" rx="2" fill="#818cf8" opacity="0.85"/>
  <text x="99" y="156" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" font-weight="500" fill="rgba(167,177,255,0.65)" letter-spacing="3.5">B2B MARKETING</text>
  <line x1="80" y1="172" x2="360" y2="172" stroke="rgba(99,102,241,0.3)" stroke-width="1"/>
  <line x1="80" y1="176" x2="200" y2="176" stroke="rgba(99,102,241,0.15)" stroke-width="0.5"/>

  <!-- Title -->
  ${textElements}

  <!-- Keyword badge -->
  ${kwBadge}

  <!-- Bottom divider + branding -->
  <line x1="80" y1="552" x2="1120" y2="552" stroke="rgba(99,102,241,0.18)" stroke-width="1"/>
  <text x="80"  y="585" font-family="ui-sans-serif,system-ui,sans-serif" font-size="15" font-weight="600" fill="rgba(255,255,255,0.22)" letter-spacing="0.5">Markable AI</text>
  <text x="1120" y="585" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" fill="rgba(129,140,248,0.28)" text-anchor="end" letter-spacing="0.3">AI-powered B2B Marketing</text>
</svg>`

  return Buffer.from(svg, 'utf-8')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function generateFeaturedImage(
  title: string,
  keyword: string | null,
  brandDescription?: string | null,
  imageStyleInstructions?: string | null,
  referenceImageUrl?: string | null,
): Promise<string | null> {
  const prompt = [
    `Professional B2B marketing blog featured image for an article titled "${title}".`,
    `Include the article title text "${title}" as a styled heading overlaid on the image. The text should be clearly legible with high contrast.`,
    keyword ? `Main topic: ${keyword}.` : '',
    brandDescription ? `Company context: ${brandDescription}.` : '',
    referenceImageUrl
      ? 'Follow the visual style of the reference design image.'
      : 'Visual style: clean modern corporate illustration with soft blue and navy gradient background. Abstract geometric shapes, professional iconography. Wide horizontal composition.',
    imageStyleInstructions ? imageStyleInstructions : '',
  ].filter(Boolean).join(' ')

  // AI生成を試みる（失敗してもSVGフォールバックがある）
  let aiUrl: string | null = null
  try {
    aiUrl = await generateImageWithGemini(prompt, `articles/featured-${Date.now()}`, referenceImageUrl)
  } catch (err) {
    console.warn('[generateFeaturedImage] generateImageWithGemini threw:', err instanceof Error ? err.message : err)
  }
  if (aiUrl) return aiUrl

  // フォールバック: ブランデッドSVG画像（data URL として DB に保存）
  try {
    const svgBuffer = generateFeaturedSvg(title, keyword)
    return `data:image/svg+xml;base64,${svgBuffer.toString('base64')}`
  } catch (err) {
    console.error('SVG fallback failed:', err)
    return null
  }
}

// ─── 記事内図解生成（DALL-E 3）────────────────────────────────────

type DiagramSpec = { marker: string; title: string; mermaidCode: string; imagePrompt: string; insertAfterH2: string }

/**
 * DALL-E 3 で記事内図解画像を生成する
 */
async function generateDiagramImage(spec: DiagramSpec, idx: number): Promise<string | null> {
  const prompt = [
    spec.imagePrompt,
    'Visual style: clean B2B infographic with professional flat design.',
    'Color scheme: blue (#3b82f6) and white with light gray accents.',
    'Clear step-by-step layout with icons and arrows. Japanese text labels allowed.',
    'High quality, modern corporate illustration. No background clutter.',
  ].join(' ')

  try {
    const res = await getOpenAI().images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'url',
    })
    const imageUrl = res.data?.[0]?.url
    if (!imageUrl) return null

    const response = await fetch(imageUrl)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    const blob = await put(`diagrams/diag-${idx}-${Date.now()}.jpg`, buffer, { access: 'private' })
    return blob.url
  } catch (err) {
    console.error(`DALL-E 3 diagram image ${idx} failed:`, err)
    return null
  }
}

export async function generateDiagrams(
  articleHtml: string,
  title: string,
  keyword: string | null,
  diagramPreference?: string | null,
  diagramInstructions?: string | null,
): Promise<{ specs: DiagramSpec[] }> {
  try {
    const res = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: { responseMimeType: 'application/json', temperature: 0.4 },
      contents: `以下のSEO記事HTMLを分析し、図解・インフォグラフィックを挿入すると理解が深まるH2セクションを2〜3つ選んでください。

記事タイトル: "${title}"
${keyword ? `キーワード: "${keyword}"` : ''}

記事HTML:
${articleHtml.slice(0, 6000)}

---
各セクションに対して:
1. Mermaidコード（構造の参考用）
2. 画像生成AIへの英語プロンプト（視覚的なインフォグラフィック用）

を生成してください。

【Mermaidの記法ルール】
- ノードラベルは必ず二重引用符: A["ラベル"]
- ノードIDはアルファベット+数字のみ
${diagramPreference && diagramPreference !== 'auto'
  ? `\n【図解の種類指定】必ず以下のMermaid記法を使用すること: ${diagramPreference === 'flowchart' ? 'flowchart TD (またはflowchart LR)' : diagramPreference === 'sequenceDiagram' ? 'sequenceDiagram' : 'graph LR (またはgraph TD)'}`
  : ''}
${diagramInstructions ? `\n【図解への追加指示】${diagramInstructions}` : ''}

以下のJSON配列形式で出力:
[
  {
    "marker": "diag-1",
    "title": "図解のキャプション（日本語）",
    "mermaidCode": "graph TD\\n  A[\\"ステップ1\\"] --> B[\\"ステップ2\\"]",
    "imagePrompt": "Infographic showing the step-by-step process of [概念を英語で]. Include [具体的な要素] with Japanese labels.",
    "insertAfterH2": "挿入するH2の見出しテキスト（タグなし）"
  }
]`,
    })

    const text = res.text ?? ''
    let specs: DiagramSpec[] = []
    try {
      specs = JSON.parse(text)
      if (!Array.isArray(specs)) specs = []
    } catch {
      return { specs: [] }
    }

    return { specs }
  } catch (err) {
    console.warn('Diagram generation failed:', err)
    return { specs: [] }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── 記事内テーブル生成 ───────────────────────────────────────────

type TableSpec = { marker: string; title: string; htmlContent: string; insertAfterH2: string }

export async function generateTables(
  articleHtml: string,
  title: string,
  keyword: string | null,
): Promise<{ specs: TableSpec[] }> {
  try {
    const res = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: { responseMimeType: 'application/json', temperature: 0.3 },
      contents: `以下のSEO記事HTMLを分析し、比較表・スペック表・まとめ表などのHTMLテーブルを挿入すると価値が高まるH2セクションを1〜2つ選んでください。

記事タイトル: "${title}"
${keyword ? `キーワード: "${keyword}"` : ''}

記事HTML（冒頭6000文字）:
${articleHtml.slice(0, 6000)}

---
各セクションに合ったHTMLテーブルを生成してください。
- <table class="wp-block-table"> タグを使用
- <thead><tr><th> でヘッダー行
- <tbody><tr><td> でデータ行
- 3〜6列、3〜8行程度
- 日本語テキストを使用

以下のJSON配列形式で出力（htmlContentはエスケープされた文字列）:
[
  {
    "marker": "table-1",
    "title": "表のキャプション（日本語）",
    "htmlContent": "<table class=\\"wp-block-table\\"><thead>...</thead><tbody>...</tbody></table>",
    "insertAfterH2": "挿入するH2の見出しテキスト（タグなし）"
  }
]`,
    })

    const text = res.text ?? ''
    let specs: TableSpec[] = []
    try {
      specs = JSON.parse(text)
      if (!Array.isArray(specs)) specs = []
    } catch {
      return { specs: [] }
    }
    return { specs }
  } catch (err) {
    console.warn('Table generation failed:', err)
    return { specs: [] }
  }
}

const ARTICLE_PAGE_SIZE = 20

export async function listArticles(tenantId: string, status?: string, page = 1, projectId?: string) {
  const where = {
    tenantId,
    ...(projectId ? { projectId } : {}),
    ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
  }
  const skip = (page - 1) * ARTICLE_PAGE_SIZE
  const [articles, total] = await Promise.all([
    prisma.seoArticle.findMany({
      where,
      include: {
        keyword: { select: { text: true } },
        diagrams: { select: { id: true, marker: true, title: true, mermaidCode: true, imageUrl: true }, orderBy: { createdAt: 'asc' } },
        tables: { select: { id: true, marker: true, title: true, htmlContent: true }, orderBy: { createdAt: 'asc' } },
      },
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
