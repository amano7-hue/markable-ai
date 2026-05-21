import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { GoogleGenAI } from '@google/genai'
import { optimizeHtml } from '@/modules/seo/article-service'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

export const maxDuration = 120

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId } = await params
  const body = await req.json().catch(() => ({})) as {
    sectionH2: string
    sectionHtml: string
    beforeContext?: string
    afterContext?: string
    instructions?: string
  }

  if (!body.sectionH2 || !body.sectionHtml) {
    return NextResponse.json({ error: 'sectionH2 と sectionHtml は必須です' }, { status: 400 })
  }

  const article = await prisma.seoArticle.findFirst({
    where: { id: articleId, tenantId: ctx.tenant.id },
    select: { id: true, title: true },
  })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandProfile = await prisma.brandProfile.findFirst({
    where: { tenantId: ctx.tenant.id },
    select: { tone: true, ngWords: true, preferredPhrases: true },
  })

  const ngWordsLine = (brandProfile?.ngWords as string[] | null)?.length
    ? `使用禁止ワード: ${(brandProfile!.ngWords as string[]).join('、')}`
    : ''

  const instructionsLine = body.instructions
    ? `\n\n【リライト指示】${body.instructions}`
    : ''

  const contextSection = [
    body.beforeContext ? `【前後の文脈 - 直前のセクション末尾】\n${body.beforeContext.slice(-300)}` : '',
    body.afterContext ? `【前後の文脈 - 直後のセクション冒頭】\n${body.afterContext.slice(0, 300)}` : '',
  ].filter(Boolean).join('\n\n')

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `以下のSEO記事の1セクションをリライトしてください。

記事タイトル: "${article.title}"
対象セクション: "${body.sectionH2}"
${ngWordsLine ? `\n${ngWordsLine}` : ''}${instructionsLine}

${contextSection ? `${contextSection}\n\n` : ''}【リライト対象HTML】
${body.sectionHtml}

【リライト方針】
- 前後の文脈と自然につながるよう文体・語調を統一する
- セクションの見出し（<h2>タグ）は変更しない
- HTMLタグ構造を維持する（<p>, <ul>, <li>, <strong>, <mark> など）
- <p>タグ内に<br>タグは使用しない（改行は新しい<p>タグで）
- <strong>: 重要な専門用語・定義（段落ごとに1〜2箇所）
- <mark class="highlight">: 最も伝えたいインサイト・結論（セクション全体で2〜3箇所）
- 煽情的・あおり系の表現は避け、中立的・専門的なトーンにする
- 読みやすさ向上: 各段落は3〜5文、1段落1トピック

リライト後のHTMLのみを出力してください（前置きや説明文は不要）。`,
  })

  const rewrittenRaw = result.text ?? ''
  const rewrittenHtml = optimizeHtml(rewrittenRaw)

  return NextResponse.json({ rewrittenHtml })
}
