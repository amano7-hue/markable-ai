/**
 * 診断用: 各画像生成APIが使えるかテストする
 * GET /api/debug/image-gen
 */
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { prisma } from '@/lib/db/client'
import { get as getBlob } from '@vercel/blob'

async function fetchBlobAsBase64(url: string): Promise<string | null> {
  try {
    const result = await getBlob(url, { access: 'private' })
    if (!result || result.statusCode !== 200) return null
    const reader = result.stream.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('base64')
  } catch {
    return null
  }
}

export const maxDuration = 120

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results: Record<string, { ok: boolean; error?: string }> = {}
  const TEST_PROMPT = 'シンプルな青い四角形、白い背景。プロフェッショナルなデザイン。'

  // 0. 参照画像の取得テスト
  const brandProfile = await prisma.brandProfile.findFirst({
    where: { tenantId: ctx.tenant.id },
    select: { referenceImageUrl: true },
  })
  const referenceImageUrl = (brandProfile?.referenceImageUrl as string | null) ?? null
  results['referenceImageUrl'] = { ok: !!referenceImageUrl }

  let refBase64: string | null = null
  if (referenceImageUrl) {
    refBase64 = await fetchBlobAsBase64(referenceImageUrl).catch(() => null)
    results['fetchPrivateBlob'] = { ok: !!refBase64, error: refBase64 ? undefined : 'Blob取得失敗' }
  }

  // 1. OpenAI gpt-image-2
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    const res = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: TEST_PROMPT,
      n: 1,
      size: '1024x1024',
    })
    results['gpt-image-2'] = { ok: !!res.data?.[0]?.b64_json }
  } catch (e) {
    results['gpt-image-2'] = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // 2. OpenAI gpt-image-1
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    const res = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: TEST_PROMPT,
      n: 1,
      size: '1024x1024',
    })
    results['gpt-image-1'] = { ok: !!res.data?.[0]?.b64_json }
  } catch (e) {
    results['gpt-image-1'] = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // 3. Gemini 画像生成モデルを各APIバージョンで試す
  const API_VERSIONS = ['v1beta', 'v1alpha', 'v1'] as const
  const IMAGE_GEN_MODELS = [
    'gemini-2.5-flash-preview-image-generation',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp-image-generation',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite',
  ]

  for (const apiVersion of API_VERSIONS) {
    const client = new GoogleGenAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
      apiVersion,
    })
    for (const model of IMAGE_GEN_MODELS) {
      const key = `gemini:${apiVersion}:${model}`
      try {
        const res = await client.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: TEST_PROMPT }] }],
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        })
        const parts = res.candidates?.[0]?.content?.parts ?? []
        const hasImage = parts.some((p: { inlineData?: { data?: string } }) => p.inlineData?.data)
        results[key] = { ok: hasImage, error: hasImage ? undefined : 'テキストのみ返答（画像なし）' }
        if (hasImage) break // このAPIバージョンで成功したら次のモデルは試さない
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        // 404以外のエラーは記録（接続OK、モデルだけが問題でない可能性）
        results[key] = { ok: false, error: msg.slice(0, 120) }
        if (!msg.includes('NOT_FOUND') && !msg.includes('not found')) break // 別のエラーなら同バージョンの次モデルも試す価値なし
      }
    }
  }

  // 4. Imagen 3 generateImages（参考：Vertex AI専用のはず）
  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })
    const res = await genai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: TEST_PROMPT,
      config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' },
    })
    results['imagen-3-generate'] = { ok: !!res.generatedImages?.[0]?.image?.imageBytes }
  } catch (e) {
    results['imagen-3-generate'] = { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : String(e) }
  }

  return NextResponse.json({ results })
}
