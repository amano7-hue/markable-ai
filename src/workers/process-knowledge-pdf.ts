import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import Anthropic from '@anthropic-ai/sdk'
import { del } from '@vercel/blob'

const client = new Anthropic()

export const processKnowledgePdf = inngest.createFunction(
  {
    id: 'process-knowledge-pdf',
    name: 'ナレッジ PDF テキスト抽出',
    triggers: [{ event: 'knowledge/pdf.process' }],
    // Anthropic の処理が長くなる場合に備えて最大 10 分
    timeouts: { finish: '10m' },
  },
  async ({ event, step }) => {
    const { knowledgeSourceId, blobUrl } = (event as unknown as {
      data: { knowledgeSourceId: string; blobUrl: string }
    }).data

    const content = await step.run('extract-text', async () => {
      try {
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8096,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'url', url: blobUrl },
                },
                {
                  type: 'text',
                  text: 'このPDFの内容を抽出してください。見出し・本文・表・箇条書きの構造を保持してください。ページ番号・フッター・ヘッダーは除外してください。説明文や前置きは不要で、抽出テキストのみ出力してください。',
                },
              ],
            },
          ],
        })
        return response.content[0].type === 'text' ? response.content[0].text : ''
      } finally {
        await del(blobUrl).catch(() => {})
      }
    })

    await step.run('save-content', () =>
      prisma.knowledgeSource.update({
        where: { id: knowledgeSourceId },
        data: {
          content: content || '',
          status: content ? 'ready' : 'failed',
        },
      }),
    )

    return { knowledgeSourceId, ok: !!content }
  },
)
