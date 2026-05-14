import { NextRequest } from 'next/server'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { put, del } from '@vercel/blob'
import { ok, err } from '@/lib/api-response'

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
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const blob = await put(`brand/${ctx.tenant.id}/reference.${ext}`, buffer, { access: 'private' })
    blobUrl = blob.url
  } catch (e) {
    console.error('[reference-image] Vercel Blob put failed:', e)
    return err('画像の保存に失敗しました', 500)
  }

  const existing = await prisma.brandProfile.findUnique({ where: { projectId: project.id } })
  const profile = existing
    ? await prisma.brandProfile.update({
        where: { projectId: project.id, tenantId: ctx.tenant.id },
        data: { referenceImageUrl: blobUrl },
      })
    : await prisma.brandProfile.create({
        data: {
          tenantId: ctx.tenant.id,
          projectId: project.id,
          ngWords: [],
          preferredPhrases: [],
          referenceImageUrl: blobUrl,
        },
      })

  return ok({ referenceImageUrl: profile.referenceImageUrl })
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
