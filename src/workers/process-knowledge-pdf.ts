import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/db/client'
import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

type PdfProcessEvent = {
  data: {
    knowledgeSourceId: string
    // DB チャンク方式
    uploadId?: string
    totalChunks?: number
    tenantId?: string
    // 後方互換: 直接 Blob URL 方式
    blobUrl?: string
  }
}

export const processKnowledgePdf = inngest.createFunction(
  {
    id: 'process-knowledge-pdf',
    name: 'ナレッジ PDF テキスト抽出',
    triggers: [{ event: 'knowledge/pdf.process' }],
    timeouts: { finish: '10m' },
    // 失敗時にステータスを failed に更新
    onFailure: async ({ event }) => {
      const data = (event.data as unknown as PdfProcessEvent['data'])
      if (data?.knowledgeSourceId) {
        await prisma.knowledgeSource
          .update({
            where: { id: data.knowledgeSourceId },
            data: { status: 'failed' },
          })
          .catch(() => {})
      }
    },
  },
  async ({ event, step }) => {
    const { knowledgeSourceId, uploadId, totalChunks, tenantId, blobUrl } =
      (event as unknown as PdfProcessEvent).data

    console.log(`[process-knowledge-pdf] start knowledgeSourceId=${knowledgeSourceId} uploadId=${uploadId} totalChunks=${totalChunks}`)

    const content = await step.run('extract-text', async () => {
      let pdfBuffer: Buffer

      if (uploadId && totalChunks) {
        // DB からチャンクを取得して結合
        console.log(`[process-knowledge-pdf] fetching ${totalChunks} chunks from DB`)
        const chunks = await prisma.pdfUploadChunk.findMany({
          where: { uploadId, ...(tenantId ? { tenantId } : {}) },
          orderBy: { chunkIndex: 'asc' },
          select: { data: true },
        })
        if (chunks.length !== totalChunks) {
          throw new Error(`チャンク数不一致: 期待=${totalChunks} 実際=${chunks.length}`)
        }
        pdfBuffer = Buffer.concat(chunks.map((c) => c.data))
        console.log(`[process-knowledge-pdf] assembled PDF buffer: ${pdfBuffer.length} bytes`)
      } else if (blobUrl) {
        // 後方互換: Blob URL から直接ダウンロード
        const res = await fetch(blobUrl)
        if (!res.ok) throw new Error(`Blob ダウンロード失敗: ${res.status}`)
        pdfBuffer = Buffer.from(await res.arrayBuffer())
      } else {
        throw new Error('uploadId または blobUrl が必要です')
      }

      // DB のチャンクを削除 (処理前に削除して DB を軽量化)
      if (uploadId) {
        await prisma.pdfUploadChunk
          .deleteMany({ where: { uploadId, ...(tenantId ? { tenantId } : {}) } })
          .catch(() => {})
      }

      // Gemini にインライン base64 で直接渡す (Files API アップロード不要)
      // base64 サイズ: 30MB PDF → 40MB base64 (Gemini の 20MB inline 制限内を超える場合は Files API にフォールバック)
      const base64 = pdfBuffer.toString('base64')
      const inlineSizeMB = base64.length / 1024 / 1024

      let extractedText: string | undefined

      console.log(`[process-knowledge-pdf] base64 size: ${inlineSizeMB.toFixed(1)}MB`)

      if (inlineSizeMB <= 18) {
        // インライン base64 (Files API アップロードなし)
        console.log(`[process-knowledge-pdf] calling Gemini inline...`)
        const response = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'application/pdf', data: base64 } },
                {
                  text: 'このPDFの内容を抽出してください。見出し・本文・表・箇条書きの構造を保持してください。ページ番号・フッター・ヘッダーは除外してください。説明文や前置きは不要で、抽出テキストのみ出力してください。',
                },
              ],
            },
          ],
        })
        extractedText = response.text ?? ''
        console.log(`[process-knowledge-pdf] Gemini inline done, text length=${extractedText.length}`)
      } else {
        // 大きすぎる場合は Files API を使用
        let geminiFileName: string | undefined
        try {
          const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' })
          const uploaded = await genai.files.upload({
            file: pdfBlob,
            config: { mimeType: 'application/pdf', displayName: `knowledge-${knowledgeSourceId}` },
          })
          geminiFileName = uploaded.name

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
          extractedText = response.text ?? ''
        } finally {
          if (geminiFileName) {
            await genai.files.delete({ name: geminiFileName }).catch(() => {})
          }
        }
      }

      return extractedText ?? ''
    })

    await step.run('save-content', () =>
      prisma.knowledgeSource.update({
        where: { id: knowledgeSourceId, ...(tenantId ? { tenantId } : {}) },
        data: {
          content: content || '',
          status: content ? 'ready' : 'failed',
        },
      }),
    )

    return { knowledgeSourceId, ok: !!content }
  },
)
