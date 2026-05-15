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
    ? `${customPrompt} Professional B2B marketing blog featured image, wide 16:9 horizontal composition. Include the custom prompt text as a styled heading. Do not include any year, date, or copyright text.`
    : [
        `Professional B2B marketing blog featured image. Wide 16:9 horizontal composition.`,
        `Display the following title as the main heading on the image, clearly legible with high contrast: "${article.title}". Use the exact title text — do not add any year, date, or extra text.`,
        keywordText ? `Visual theme: ${keywordText}.` : '',
        brandProfile?.companyDescription ? `Company context: ${brandProfile.companyDescription}.` : '',
        referenceImageUrl
          ? 'Use the exact same visual style as the reference design image.'
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
