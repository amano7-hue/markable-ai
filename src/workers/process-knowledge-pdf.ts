import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { GoogleGenAI } from '@google/genai'
import { del } from '@vercel/blob'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

export const processKnowledgePdf = inngest.createFunction(
  {
    id: 'process-knowledge-pdf',
    name: 'ナレッジ PDF テキスト抽出',
    triggers: [{ event: 'knowledge/pdf.process' }],
    timeouts: { finish: '10m' },
  },
  async ({ event, step }) => {
    const { knowledgeSourceId, blobUrl } = (event as unknown as {
      data: { knowledgeSourceId: string; blobUrl: string }
    }).data

    const content = await step.run('extract-text', async () => {
      let geminiFileName: string | undefined

      try {
        // Vercel Blob から PDF をダウンロード
        const pdfRes = await fetch(blobUrl)
        if (!pdfRes.ok) throw new Error(`Blob ダウンロード失敗: ${pdfRes.status}`)
        const arrayBuffer = await pdfRes.arrayBuffer()
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' })

        // Gemini Files API にアップロード
        const uploaded = await genai.files.upload({
          file: blob,
          config: { mimeType: 'application/pdf', displayName: `knowledge-${knowledgeSourceId}` },
        })
        geminiFileName = uploaded.name

        // テキスト抽出
        const response = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { fileData: { mimeType: 'application/pdf', fileUri: uploaded.uri! } },
                {
                  text: 'このPDFの内容を抽出してください。見出し・本文・表・箇条書きの構造を保持してください。ページ番号・フッター・ヘッダーは除外してください。説明文や前置きは不要で、抽出テキストのみ出力してください。',
                },
              ],
            },
          ],
        })

        return response.text ?? ''
      } finally {
        // Gemini ファイルを削除
        if (geminiFileName) {
          await genai.files.delete({ name: geminiFileName }).catch(() => {})
        }
        // Vercel Blob を削除
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
