import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  const blocks = await prisma.ctaBlock.findMany({
    where: projectId
      ? { tenantId: ctx.tenant.id, projectId }
      : { tenantId: ctx.tenant.id },
    orderBy: { createdAt: 'asc' },
  })
  return ok(blocks)
}

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { shortcode, label, content, projectId } = await req.json()
  if (!shortcode || !label || !content) return err('shortcode・label・content は必須です', 400)
  if (!/^[a-z0-9_-]+$/.test(shortcode)) return err('shortcode は英小文字・数字・-・_ のみ使用可', 400)

  // projectId を解決（未指定ならデフォルトプロジェクト）
  const resolvedProjectId = projectId
    ? (await prisma.project.findFirst({ where: { id: projectId, tenantId: ctx.tenant.id }, select: { id: true } }))?.id
    : (await prisma.project.findFirst({
        where: { tenantId: ctx.tenant.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      }))?.id
  if (!resolvedProjectId) return err('プロジェクトが見つかりません', 404)

  const block = await prisma.ctaBlock.create({
    data: { tenantId: ctx.tenant.id, projectId: resolvedProjectId, shortcode, label, content },
  })
  return ok(block, 201)
}
