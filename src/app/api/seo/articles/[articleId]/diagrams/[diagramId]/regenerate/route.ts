import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { GoogleGenAI } from '@google/genai'
import { generateImageWithGemini } from '@/modules/seo/article-service'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ articleId: string; diagramId: string }> },
) {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId, diagramId } = await params
  const body = await req.json().catch(() => ({}))
  const customPrompt: string | undefined = body.customPrompt?.trim() || undefined

  const [diagram, brandProfile] = await Promise.all([
    prisma.seoArticleDiagram.findFirst({
      where: { id: diagramId, tenantId: ctx.tenant.id, articleId },
      include: { article: { select: { title: true } } },
    }),
    prisma.brandProfile.findFirst({
      where: { tenantId: ctx.tenant.id },
      select: { referenceImageUrl: true },
    }),
  ])
  if (!diagram) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const referenceImageUrl = (brandProfile?.referenceImageUrl as string | null) ?? null
  const customInstruction = customPrompt ? `\n\n【追加指示】${customPrompt}` : ''

  // Mermaidコードを再生成
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

  // 参照画像スタイルを踏襲した図解画像を生成
  let newImageUrl: string | null = null
  if (data.imagePrompt) {
    try {
      const diagramPrompt = [
        data.imagePrompt,
        'Wide 16:9 horizontal layout.',
        'Visual style: clean B2B infographic with professional flat design.',
        'All text must be in Japanese using clean, readable Japanese typography (Noto Sans JP style).',
        'Do not include any year, date, copyright notice, or watermark.',
        'Clear step-by-step layout with icons and arrows. High quality, modern corporate illustration.',
      ].join(' ')
      newImageUrl = await generateImageWithGemini(
        diagramPrompt,
        `diagrams/${diagramId}-regen-${Date.now()}`,
        referenceImageUrl,
        '1536x1024',
      )
    } catch (err) {
      console.error('Diagram image regeneration failed:', err)
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
