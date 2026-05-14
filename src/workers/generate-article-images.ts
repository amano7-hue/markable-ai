import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { generateImageWithGemini } from '@/modules/seo/article-service'

type DiagramSpec = { marker: string; title: string; mermaidCode: string; imagePrompt: string }

type FeaturedImageParams = {
  title: string
  keyword: string | null
  brandDescription: string | null
  imageStyleInstructions: string | null
  referenceImageUrl: string | null
}

type GenerateArticleImagesEvent = {
  data: {
    articleId: string
    tenantId: string
    diagramSpecs: DiagramSpec[]
    featuredImage?: FeaturedImageParams
  }
}

export const generateArticleImages = inngest.createFunction(
  {
    id: 'generate-article-images',
    name: '記事内図解画像生成',
    triggers: [{ event: 'seo/article.images.requested' }],
    timeouts: { finish: '15m' },
    retries: 1,
  },
  async ({ event, step }) => {
    const { articleId, tenantId, diagramSpecs } =
      (event as unknown as GenerateArticleImagesEvent).data
    const fi = (event as unknown as GenerateArticleImagesEvent).data.featuredImage
    const referenceImageUrl = fi?.referenceImageUrl ?? null

    // ─── 図解画像を1枚ずつ順番に生成 ─────────────────────────────────
    // generateImageWithGemini を使用することで参照画像のスタイルを反映する
    for (const [i, spec] of diagramSpecs.entries()) {
      await step.run(`generate-diagram-image-${i}`, async () => {
        const basePrompt = [
          spec.imagePrompt,
          'Visual style: clean B2B infographic with professional flat design.',
          'Clear step-by-step layout with icons and arrows. Japanese text labels allowed.',
          'High quality, modern corporate illustration. No background clutter.',
        ].join(' ')

        try {
          const url = await generateImageWithGemini(
            basePrompt,
            `diagrams/diag-${i}-${Date.now()}`,
            referenceImageUrl,
          )
          if (!url) return null

          await prisma.seoArticleDiagram.updateMany({
            where: { articleId, tenantId, marker: spec.marker },
            data: { imageUrl: url },
          })
          return url
        } catch (err) {
          console.error(`Diagram image ${i} generation failed:`, err)
          return null
        }
      })
    }

    // ─── AI版アイキャッチ画像生成 ──────────────────────────────────────
    if (fi) {
      await step.run('generate-featured-image', async () => {
        const prompt = [
          `Professional B2B marketing blog featured image for an article titled "${fi.title}".`,
          fi.keyword ? `Main topic: ${fi.keyword}.` : '',
          fi.brandDescription ? `Company context: ${fi.brandDescription}.` : '',
          fi.referenceImageUrl
            ? 'Generate in the exact same visual style as the reference design image.'
            : 'Visual style: clean modern corporate illustration with soft blue and navy gradient background. Abstract geometric shapes, professional iconography. Wide horizontal composition.',
          'NO text, NO letters, NO logos.',
          fi.imageStyleInstructions ?? '',
        ].filter(Boolean).join(' ')

        try {
          const url = await generateImageWithGemini(
            prompt,
            `articles/featured-${articleId}-${Date.now()}`,
            fi.referenceImageUrl,
          )
          if (url) {
            await prisma.seoArticle.update({
              where: { id: articleId, tenantId },
              data: { featuredImageUrl: url },
            })
          }
          return url ?? null
        } catch (err) {
          console.error('Featured image AI generation failed:', err)
          return null
        }
      })
    }

    return { diagramCount: diagramSpecs.length }
  },
)
