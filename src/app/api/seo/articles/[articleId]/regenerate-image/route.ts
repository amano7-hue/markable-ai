import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { generateImageWithGemini } from '@/modules/seo/article-service'

export const maxDuration = 120

export async function POST(req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleId } = await params
  const body = await req.json().catch(() => ({}))
  const customPrompt: string | undefined = body.customPrompt?.trim() || undefined

  const [article, keyword] = await Promise.all([
    prisma.seoArticle.findFirst({
      where: { id: articleId, tenantId: ctx.tenant.id },
      select: { id: true, title: true },
    }),
    prisma.seoKeyword.findFirst({
      where: { articles: { some: { id: articleId } } },
      select: { text: true },
    }),
  ])
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    let featuredImageUrl: string | null = null

    if (customPrompt) {
      // カスタムプロンプトで AI 画像を生成
      const aiPrompt = `${customPrompt} Style: professional B2B marketing blog featured image, wide horizontal 16:9 composition, modern corporate illustration with blue and navy gradient. NO text, NO letters, NO logos.`
      featuredImageUrl = await generateImageWithGemini(aiPrompt, `articles/featured-${articleId}-${Date.now()}`)
    }

    if (!featuredImageUrl) {
      // AI 生成失敗またはカスタムプロンプトなし → SVG フォールバック
      const svgBuffer = buildFeaturedSvg(article.title, keyword?.text ?? null)
      featuredImageUrl = `data:image/svg+xml;base64,${svgBuffer.toString('base64')}`
    }

    await prisma.seoArticle.update({
      where: { id: articleId, tenantId: ctx.tenant.id },
      data: { featuredImageUrl },
    })
    return NextResponse.json({ featuredImageUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[regenerate-image] failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildFeaturedSvg(title: string, keyword: string | null): Buffer {
  // タイトルを最大22文字で折り返す（最大3行）
  const MAX = 22
  const chars = [...title]
  const lines: string[] = []
  let cur = ''
  for (const ch of chars) {
    cur += ch
    if (cur.length >= MAX) { lines.push(cur); cur = '' }
  }
  if (cur) lines.push(cur)
  const rows = lines.slice(0, 3)

  const LINE_H = 70
  const BASE_Y = 270 - ((rows.length - 1) * LINE_H) / 2
  const textSvg = rows.map((row, i) =>
    `<text x="600" y="${BASE_Y + i * LINE_H}" font-family="sans-serif" font-size="54" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${escXml(row)}</text>`
  ).join('\n  ')

  const kw = keyword ? escXml(keyword) : ''
  const kwW = kw ? Math.min(kw.length * 20 + 48, 500) : 0
  const kwX = 600 - kwW / 2
  const kwSvg = kw ? `
  <rect x="${kwX}" y="418" width="${kwW}" height="44" rx="22" fill="rgba(255,255,255,0.18)"/>
  <text x="600" y="440" font-family="sans-serif" font-size="20" fill="rgba(255,255,255,0.9)" text-anchor="middle" dominant-baseline="middle">${kw}</text>` : ''

  return Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f2044"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1100" cy="80"  r="220" fill="rgba(255,255,255,0.06)"/>
  <circle cx="80"   cy="530" r="200" fill="rgba(255,255,255,0.04)"/>
  <rect x="0" y="0" width="8" height="630" fill="rgba(96,165,250,0.7)"/>
  ${textSvg}${kwSvg}
  <text x="600" y="598" font-family="sans-serif" font-size="16" fill="rgba(255,255,255,0.35)" text-anchor="middle">Markable AI</text>
</svg>`, 'utf-8')
}
