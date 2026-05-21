import { z } from 'zod'

export const CreateKeywordSchema = z.object({
  text: z.string().min(2).max(200),
  intent: z.enum(['informational', 'commercial', 'navigational']).optional(),
})

export const UpdateKeywordSchema = z.object({
  text: z.string().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
})

const HeadingStructureSchema = z.object({
  h1: z.string(),
  sections: z.array(z.object({
    h2: z.string(),
    h3s: z.array(z.string()),
  })),
})

export const AnalyzeArticleSchema = z.object({
  keyword: z.string().max(200),
  title: z.string().min(2).max(200),
})

export const GenerateArticleSchema = z.object({
  keywordId: z.string().optional(),
  keywordText: z.string().max(200).optional(), // 自由入力キーワード (keywordId がない場合に使用)
  title: z.string().min(2).max(200),
  ownInsights: z.string().max(10000).optional(), // 独自データ・事例
  // 追加フィールド
  projectId: z.string().optional(),               // プロジェクトID（ナレッジ・ブランド・CTAの絞り込み用）
  persona: z.string().max(500).optional(),         // 想定ペルソナ上書き
  customHeadings: HeadingStructureSchema.optional(), // ユーザー編集済み見出し構成
  trustedSourcesOnly: z.boolean().optional(),      // 信頼性の高い参照元のみ使用
  // 見出し・文体オプション
  relatedKeywords: z.string().max(500).optional(),     // カンマ区切りの関連キーワード
  avoidSensationalHeadings: z.boolean().optional(),    // あおり系の見出しを避ける
  // バックグラウンド分析フェーズで作成した既存記事ID（更新して使用）
  existingArticleId: z.string().optional(),
  // リライト時などの追加指示（ドラフト生成プロンプトに最優先で注入）
  additionalInstructions: z.string().max(10000).optional(),
  // 分析フェーズで事前計算済みの結果（再計算をスキップして高速化）
  precomputedReader: z.object({
    searchIntent: z.enum(['informational', 'navigational', 'transactional', 'commercial']),
    targetAudience: z.string(),
    keyQuestions: z.array(z.string()),
    painPoints: z.array(z.string()),
    relatedQuestions: z.array(z.string()),
    relatedSearches: z.array(z.string()),
  }).optional(),
  precomputedCompetitor: z.object({
    recommendedWordCount: z.number(),
    minWordCount: z.number(),
    maxWordCount: z.number(),
    averageWordCount: z.number(),
    reasoning: z.string(),
    scrapedPages: z.array(z.object({ url: z.string(), charCount: z.number(), title: z.string().nullable() })).optional(),
    scrapeSuccess: z.boolean().optional(),
  }).optional(),
})

export type CreateKeywordInput = z.infer<typeof CreateKeywordSchema>
export type UpdateKeywordInput = z.infer<typeof UpdateKeywordSchema>
export type GenerateArticleInput = z.infer<typeof GenerateArticleSchema>
export type AnalyzeArticleInput = z.infer<typeof AnalyzeArticleSchema>
