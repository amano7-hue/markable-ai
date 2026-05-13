import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ articleId: string; tableId: string }> },
) {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId, tableId } = await params
  const table = await prisma.seoArticleTable.findFirst({
    where: { id: tableId, tenantId: ctx.tenant.id, articleId },
    include: { article: { select: { title: true } } },
  })
  if (!table) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const res = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    config: { responseMimeType: 'application/json', temperature: 0.5 },
    contents: `記事「${table.article.title}」の「${table.title}」という表を再生成してください。
既存の表HTML:
${table.htmlContent}

より充実した内容に改善した HTMLテーブルを生成してください。
- <table class="wp-block-table"> タグを使用
- <thead><tr><th> でヘッダー行
- <tbody><tr><td> でデータ行
- 日本語テキストを使用

以下のJSON形式で出力:
{ "title": "新しいキャプション", "htmlContent": "<table class=\\"wp-block-table\\">...</table>" }`,
  })

  let data: { title: string; htmlContent: string }
  try {
    data = JSON.parse(res.text ?? '{}')
    if (!data.htmlContent) throw new Error('empty')
  } catch {
    return NextResponse.json({ error: '再生成に失敗しました' }, { status: 500 })
  }

  const updated = await prisma.seoArticleTable.update({
    where: { id: tableId, tenantId: ctx.tenant.id },
    data: { htmlContent: data.htmlContent, title: data.title },
  })

  return NextResponse.json(updated)
}
