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

  const [article, keyword, brandProfile] = await Promise.all([
    prisma.seoArticle.findFirst({
      where: { id: articleId, tenantId: ctx.tenant.id },
      select: { id: true, title: true },
    }),
    prisma.seoKeyword.findFirst({
      where: { articles: { some: { id: articleId } } },
      select: { text: true },
    }),
    prisma.brandProfile.findFirst({
      where: { tenantId: ctx.tenant.id },
      select: {
        companyDescription: true,
        imageStyleInstructions: true,
        referenceImageUrl: true,
      },
    }),
  ])
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const keywordText = keyword?.text ?? null
  const referenceImageUrl = (brandProfile?.referenceImageUrl as string | null) ?? null

  const prompt = customPrompt
    ? `${customPrompt} Professional B2B marketing blog featured image, wide horizontal 16:9 composition. Include the article title as styled text overlay.`
    : [
        `Professional B2B marketing blog featured image for an article titled "${article.title}".`,
        `Include the article title text "${article.title}" as a styled heading overlaid on the image. The text should be clearly legible with high contrast.`,
        keywordText ? `Main topic: ${keywordText}.` : '',
        brandProfile?.companyDescription ? `Company context: ${brandProfile.companyDescription}.` : '',
        referenceImageUrl
          ? 'Generate in the exact same visual style as the reference design image.'
          : 'Visual style: clean modern corporate illustration with soft blue and navy gradient background.',
        (brandProfile?.imageStyleInstructions as string | null) ?? '',
      ].filter(Boolean).join(' ')

  console.log('[regenerate-image] referenceImageUrl:', referenceImageUrl ? '設定あり' : 'なし')

  try {
    const featuredImageUrl = await generateImageWithGemini(
      prompt,
      `articles/featured-${articleId}-${Date.now()}`,
      referenceImageUrl,
      '1536x1024',
    )

    if (!featuredImageUrl) {
      console.error('[regenerate-image] generateImageWithGemini returned null')
      return NextResponse.json({ error: 'すべての画像生成APIが失敗しました。APIキーとクォータを確認してください。' }, { status: 500 })
    }

    await prisma.seoArticle.update({
      where: { id: articleId, tenantId: ctx.tenant.id },
      data: { featuredImageUrl },
    })
    return NextResponse.json({ featuredImageUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[regenerate-image] unexpected error:', msg)
    return NextResponse.json({ error: `エラー: ${msg}` }, { status: 500 })
  }
}
