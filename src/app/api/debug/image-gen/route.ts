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

export const maxDuration = 60

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results: Record<string, { ok: boolean; error?: string }> = {}
  const TEST_PROMPT = 'A simple blue square on white background. Professional design.'

  // 0. 参照画像の取得テスト
  const brandProfile = await prisma.brandProfile.findFirst({
    where: { tenantId: ctx.tenant.id },
    select: { referenceImageUrl: true },
  })
  const referenceImageUrl = (brandProfile?.referenceImageUrl as string | null) ?? null
  results['referenceImageUrl'] = { ok: !!referenceImageUrl, error: referenceImageUrl ? undefined : '参照画像が設定されていません' }

  let refBase64: string | null = null
  if (referenceImageUrl) {
    try {
      refBase64 = await fetchBlobAsBase64(referenceImageUrl)
      results['fetchPrivateBlob'] = { ok: !!refBase64, error: refBase64 ? undefined : 'Blob取得失敗' }
    } catch (e) {
      results['fetchPrivateBlob'] = { ok: false, error: String(e) }
    }
  }

  // 1. DALL-E 3
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    const res = await openai.images.generate({
      model: 'dall-e-3',
      prompt: TEST_PROMPT,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    })
    results['dalle-3'] = { ok: !!res.data?.[0]?.url }
  } catch (e) {
    results['dalle-3'] = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // 2. gpt-image-1（参照画像ありの場合のみ）
  if (refBase64) {
    try {
      const { toFile } = await import('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
      const imageFile = await toFile(Buffer.from(refBase64, 'base64'), 'reference.jpg', { type: 'image/jpeg' })
      const res = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFile,
        prompt: TEST_PROMPT,
        n: 1,
        size: '1024x1024',
      })
      results['gpt-image-1'] = { ok: !!res.data?.[0]?.b64_json }
    } catch (e) {
      results['gpt-image-1'] = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  } else {
    results['gpt-image-1'] = { ok: false, error: '参照画像なし（スキップ）' }
  }

  // 3. Imagen 3 generateImages
  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })
    const res = await genai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: TEST_PROMPT,
      config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' },
    })
    results['imagen-3-generate'] = { ok: !!res.generatedImages?.[0]?.image?.imageBytes }
  } catch (e) {
    results['imagen-3-generate'] = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // 4. Gemini Flash image generation（v1alpha API必須）
  const FLASH_MODELS = ['gemini-2.0-flash-preview-image-generation', 'gemini-2.0-flash-exp-image-generation', 'gemini-2.5-flash']
  for (const model of FLASH_MODELS) {
    try {
      const genaiAlpha = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!, apiVersion: 'v1alpha' })
      const res = await genaiAlpha.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: TEST_PROMPT }] }],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      })
      const parts = res.candidates?.[0]?.content?.parts ?? []
      const hasImage = parts.some((p: { inlineData?: { data?: string } }) => p.inlineData?.data)
      results[`gemini-flash-image:${model}`] = { ok: hasImage, error: hasImage ? undefined : '画像なし（テキストのみ返答）' }
      if (hasImage) break // 成功したら後続のモデルはスキップ
    } catch (e) {
      results[`gemini-flash-image:${model}`] = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  return NextResponse.json({ results })
}
