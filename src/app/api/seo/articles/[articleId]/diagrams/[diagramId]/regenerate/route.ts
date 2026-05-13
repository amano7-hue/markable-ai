import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { put } from '@vercel/blob'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })
function getOpenAI() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }) }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ articleId: string; diagramId: string }> },
) {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId, diagramId } = await params
  const body = await req.json().catch(() => ({}))
  const customPrompt: string | undefined = body.customPrompt?.trim() || undefined

  const diagram = await prisma.seoArticleDiagram.findFirst({
    where: { id: diagramId, tenantId: ctx.tenant.id, articleId },
    include: { article: { select: { title: true } } },
  })
  if (!diagram) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const customInstruction = customPrompt
    ? `\n\n【追加指示】${customPrompt}`
    : ''

  const res = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    config: { responseMimeType: 'application/json', temperature: 0.6 },
    contents: `記事「${diagram.article.title}」の中の「${diagram.title}」という図解を再生成してください。
既存のMermaidコード:
${diagram.mermaidCode}

より分かりやすく改善したMermaidコードを生成してください（flowchart TD / graph LR / sequenceDiagram のいずれか）。
シンプルで5〜8ノード程度、日本語テキストを使用すること。
ノードラベルは必ず二重引用符: A["ラベル"]${customInstruction}

以下のJSON形式で出力:
{
  "title": "新しいキャプション",
  "mermaidCode": "graph TD\\n  A[\\"ステップ1\\"] --> B[\\"ステップ2\\"]",
  "imagePrompt": "Infographic showing [内容を英語で説明]. Include [主要な要素] with professional flat design icons."
}`,
  })

  let data: { title: string; mermaidCode: string; imagePrompt?: string }
  try {
    data = JSON.parse(res.text ?? '{}')
    if (!data.mermaidCode) throw new Error('empty')
  } catch {
    return NextResponse.json({ error: '再生成に失敗しました' }, { status: 500 })
  }

  // DALL-E 3で図解画像を生成
  let newImageUrl: string | null = null
  if (data.imagePrompt) {
    try {
      const imgRes = await getOpenAI().images.generate({
        model: 'dall-e-3',
        prompt: `${data.imagePrompt} Style: clean B2B infographic, professional flat design, blue (#3b82f6) and white color scheme, clear layout with icons and arrows. No background clutter.`,
        size: '1024x1024',
        quality: 'hd',
        response_format: 'url',
      })
      const tempUrl = imgRes.data?.[0]?.url
      if (tempUrl) {
        const fetchRes = await fetch(tempUrl)
        if (fetchRes.ok) {
          const buffer = Buffer.from(await fetchRes.arrayBuffer())
          const blob = await put(`diagrams/${diagramId}-regen-${Date.now()}.jpg`, buffer, { access: 'private' })
          newImageUrl = blob.url
        }
      }
    } catch (err) {
      console.error('DALL-E 3 diagram regeneration failed:', err)
    }
  }

  const updated = await prisma.seoArticleDiagram.update({
    where: { id: diagramId, tenantId: ctx.tenant.id },
    data: {
      mermaidCode: data.mermaidCode,
      title: data.title,
      ...(newImageUrl ? { imageUrl: newImageUrl } : {}),
    },
  })

  return NextResponse.json(updated)
}
