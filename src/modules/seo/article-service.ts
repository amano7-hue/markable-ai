import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db/client'
import type { GenerateArticleInput } from './schemas'

const anthropic = new Anthropic()

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

  // ブリーフ生成
  const briefMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `BtoBマーケティング向けのSEO記事のブリーフを作成してください。

タイトル: "${input.title}"
${keywordText ? `ターゲットキーワード: "${keywordText}"` : ''}

以下の形式で250〜300文字で出力してください:
- 記事の目的と想定読者
- カバーすべき主要ポイント（3〜5点）
- 推奨文字数と構成`,
      },
    ],
  })

  const brief =
    briefMsg.content[0].type === 'text' ? briefMsg.content[0].text : ''

  // ドラフト生成
  const draftMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `以下のブリーフをもとに、BtoBマーケティング向けのSEO記事ドラフトを日本語で作成してください。

タイトル: "${input.title}"
${keywordText ? `ターゲットキーワード: "${keywordText}"` : ''}

ブリーフ:
${brief}

1200〜1500文字で、見出し（## ）を使った構造的な記事を書いてください。`,
      },
    ],
  })

  const draft =
    draftMsg.content[0].type === 'text' ? draftMsg.content[0].text : ''

  const article = await prisma.seoArticle.create({
    data: {
      tenantId,
      keywordId: input.keywordId ?? null,
      title: input.title,
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
        generatedAt: new Date().toISOString(),
      },
    },
  })

  return { articleId: article.id, approvalItemId: approvalItem.id }
}

export async function listArticles(tenantId: string, status?: string) {
  return prisma.seoArticle.findMany({
    where: {
      tenantId,
      ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
    },
    include: { keyword: { select: { text: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getArticle(tenantId: string, articleId: string) {
  return prisma.seoArticle.findFirst({
    where: { id: articleId, tenantId },
    include: { keyword: { select: { text: true } } },
  })
}
