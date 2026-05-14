import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { put, del, get as getBlob } from '@vercel/blob'
import { ok, err } from '@/lib/api-response'
import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

/** 参照画像からブランドカラーパレットを抽出する */
async function extractBrandColors(base64: string, mimeType: string): Promise<{
  primary: string; secondary: string; accent: string; background: string; text: string
} | null> {
  try {
    const res = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: `Extract the main colors from this design image. Return ONLY a JSON object with these keys: primary (main brand color), secondary (secondary color), accent (highlight/CTA color), background (main background color), text (main text color). Use hex color codes like #1a2b3c. Example: {"primary":"#2563eb","secondary":"#1e40af","accent":"#f59e0b","background":"#ffffff","text":"#111827"}` },
        ],
      }],
    })
    const raw = res.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const match = raw.match(/\{[\s\S]*?\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

// UIプレビュー用: プライベートBlobをサーバー側でフェッチしてブラウザに返す
export async function GET(req: NextRequest) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return err('url is required', 400)

  // 自ストアのURLであることを確認
  try {
    const { hostname } = new URL(url)
    if (!hostname.endsWith('.blob.vercel-storage.com')) return err('Invalid URL', 400)
  } catch {
    return err('Invalid URL', 400)
  }

  const result = await getBlob(url, { access: 'private' })
  if (!result || result.statusCode !== 200) return err('Not found', 404)

  return new NextResponse(result.stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': result.blob.contentType ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

async function resolveProject(tenantId: string, projectId?: string | null) {
  return projectId
    ? prisma.project.findFirst({ where: { id: projectId, tenantId }, select: { id: true } })
    : prisma.project.findFirst({ where: { tenantId }, select: { id: true } })
}

export async function POST(req: NextRequest) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const formData = await req.formData().catch(() => null)
  if (!formData) return err('フォームデータが不正です', 400)

  const file = formData.get('file')
  if (!(file instanceof File)) return err('ファイルが見つかりません', 400)
  if (!file.type.startsWith('image/')) return err('画像ファイルを選択してください', 400)
  if (file.size > 5 * 1024 * 1024) return err('ファイルサイズは5MB以下にしてください', 400)

  const projectIdParam = formData.get('projectId')
  const projectId = typeof projectIdParam === 'string' ? projectIdParam : null

  const project = await resolveProject(ctx.tenant.id, projectId)
  if (!project) return err('プロジェクトが見つかりません', 404)

  const ext = file.type === 'image/png' ? 'png' : (file.type === 'image/webp' ? 'webp' : 'jpg')

  let blobUrl: string
  let base64: string
  let mimeType: string
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    base64 = buffer.toString('base64')
    mimeType = file.type
    const blob = await put(`brand/${ctx.tenant.id}/reference.${ext}`, buffer, { access: 'private' })
    blobUrl = blob.url
  } catch (e) {
    console.error('[reference-image] Vercel Blob put failed:', e)
    return err('画像の保存に失敗しました', 500)
  }

  // カラーパレット抽出（非同期・失敗しても保存は続行）
  const brandColors = await extractBrandColors(base64, mimeType)

  const existing = await prisma.brandProfile.findUnique({ where: { projectId: project.id } })
  const profile = existing
    ? await prisma.brandProfile.update({
        where: { projectId: project.id, tenantId: ctx.tenant.id },
        data: { referenceImageUrl: blobUrl, ...(brandColors ? { brandColors } : {}) },
      })
    : await prisma.brandProfile.create({
        data: {
          tenantId: ctx.tenant.id,
          projectId: project.id,
          ngWords: [],
          preferredPhrases: [],
          referenceImageUrl: blobUrl,
          ...(brandColors ? { brandColors } : {}),
        },
      })

  return ok({ referenceImageUrl: profile.referenceImageUrl, brandColors })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json().catch(() => ({})) as { projectId?: string }
  const project = await resolveProject(ctx.tenant.id, body.projectId)
  if (!project) return err('プロジェクトが見つかりません', 404)

  const profile = await prisma.brandProfile.findUnique({ where: { projectId: project.id } })
  if (profile?.referenceImageUrl) {
    try { await del(profile.referenceImageUrl) } catch { /* blob削除失敗は無視 */ }
  }

  await prisma.brandProfile.update({
    where: { projectId: project.id, tenantId: ctx.tenant.id },
    data: { referenceImageUrl: null },
  })

  return ok({ deleted: true })
}
