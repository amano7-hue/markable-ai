import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import OpenAI from 'openai'
import { put } from '@vercel/blob'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

type DiagramSpec = { marker: string; title: string; mermaidCode: string; imagePrompt: string }

type GenerateArticleImagesEvent = {
  data: {
    articleId: string
    tenantId: string
    diagramSpecs: DiagramSpec[]
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

    // 図解画像を1枚ずつ順番に生成（並列だと OpenAI レート制限に当たる）
    for (const [i, spec] of diagramSpecs.entries()) {
      await step.run(`generate-diagram-image-${i}`, async () => {
        const prompt = [
          spec.imagePrompt,
          'Visual style: clean B2B infographic with professional flat design.',
          'Color scheme: blue (#3b82f6) and white with light gray accents.',
          'Clear step-by-step layout with icons and arrows. Japanese text labels allowed.',
          'High quality, modern corporate illustration. No background clutter.',
        ].join(' ')

        try {
          const res = await getOpenAI().images.generate({
            model: 'dall-e-3',
            prompt,
            size: '1024x1024',
            quality: 'standard',
            response_format: 'url',
          })
          const imageUrl = res.data?.[0]?.url
          if (!imageUrl) return null

          const response = await fetch(imageUrl)
          if (!response.ok) return null
          const buffer = Buffer.from(await response.arrayBuffer())
          const blob = await put(`diagrams/diag-${i}-${Date.now()}.jpg`, buffer, { access: 'private' })

          await prisma.seoArticleDiagram.updateMany({
            where: { articleId, tenantId, marker: spec.marker },
            data: { imageUrl: blob.url },
          })
          return blob.url
        } catch (err) {
          console.error(`Diagram image ${i} generation failed:`, err)
          return null
        }
      })
    }

    return { diagramCount: diagramSpecs.length }
  },
)
