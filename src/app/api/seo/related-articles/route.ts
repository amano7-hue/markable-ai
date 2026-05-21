import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import * as XLSX from 'xlsx'
import { z } from 'zod'

const ItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  keywords: z.string().optional(),
})

/** GET — プロジェクトの関連記事リンク一覧 */
export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return err('projectId is required', 400)

  const links = await prisma.projectArticleLink.findMany({
    where: { tenantId: ctx.tenant.id, projectId },
    orderBy: { createdAt: 'desc' },
  })

  return ok(links)
}

/** POST — CSV/XLSX ファイルアップロードで一括登録 */
export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null
  const replaceAll = formData.get('replaceAll') === 'true'

  if (!file) return err('ファイルが必要です', 400)
  if (!projectId) return err('projectId が必要です', 400)

  // プロジェクト帰属確認
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: ctx.tenant.id },
    select: { id: true },
  })
  if (!project) return err('プロジェクトが見つかりません', 404)

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase()

  let rows: Array<{ title: string; url: string; keywords?: string }> = []

  if (ext === 'csv') {
    const text = buffer.toString('utf-8')
    const lines = text.split(/\r?\n/).filter(Boolean)
    const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())
    const titleIdx = header.findIndex((h) => h === 'title' || h === 'タイトル')
    const urlIdx = header.findIndex((h) => h === 'url')
    const kwIdx = header.findIndex((h) => h === 'keywords' || h === 'キーワード')
    if (titleIdx === -1 || urlIdx === -1) return err('CSV に title / url 列が必要です', 400)

    for (const line of lines.slice(1)) {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const title = cols[titleIdx]
      const url = cols[urlIdx]
      if (!title || !url) continue
      rows.push({ title, url, keywords: kwIdx >= 0 ? cols[kwIdx] : undefined })
    }
  } else if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
    for (const row of data) {
      const title = (row['title'] ?? row['タイトル'] ?? '').toString().trim()
      const url = (row['url'] ?? row['URL'] ?? '').toString().trim()
      const keywords = (row['keywords'] ?? row['キーワード'] ?? '').toString().trim()
      if (!title || !url) continue
      rows.push({ title, url, keywords: keywords || undefined })
    }
  } else {
    return err('CSV または XLSX ファイルのみ対応しています', 400)
  }

  const valid = rows.filter((r) => ItemSchema.safeParse(r).success)
  if (valid.length === 0) return err('有効な行が見つかりませんでした', 400)

  if (replaceAll) {
    await prisma.projectArticleLink.deleteMany({
      where: { tenantId: ctx.tenant.id, projectId },
    })
  }

  await prisma.projectArticleLink.createMany({
    data: valid.map((r) => ({
      tenantId: ctx.tenant.id,
      projectId,
      title: r.title,
      url: r.url,
      keywords: r.keywords ?? null,
    })),
  })

  return ok({ inserted: valid.length })
}

/** DELETE — 個別削除 or 全削除 */
export async function DELETE(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const projectId = searchParams.get('projectId')

  if (id) {
    await prisma.projectArticleLink.deleteMany({
      where: { id, tenantId: ctx.tenant.id },
    })
  } else if (projectId) {
    await prisma.projectArticleLink.deleteMany({
      where: { projectId, tenantId: ctx.tenant.id },
    })
  } else {
    return err('id または projectId が必要です', 400)
  }

  return ok({ deleted: true })
}
