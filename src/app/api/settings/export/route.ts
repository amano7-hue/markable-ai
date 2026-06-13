import { getAuth } from '@/lib/auth/get-auth'
import { err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
}

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role !== 'OWNER') return err('OWNER 権限が必要です', 403)

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'leads'
  const tid = ctx.tenant.id

  let csv = ''
  let filename = ''

  if (type === 'leads') {
    const leads = await prisma.nurtureLead.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
    })
    filename = 'leads.csv'
    csv = toCsv(
      ['id', 'email', 'firstName', 'lastName', 'company', 'jobTitle', 'lifecycle', 'leadStatus', 'icpScore', 'emailOpenCount', 'emailClickCount', 'createdAt'],
      leads.map((l) => [
        l.id, l.email, l.firstName ?? '', l.lastName ?? '', l.company ?? '',
        l.jobTitle ?? '', l.lifecycle ?? '', l.leadStatus ?? '',
        String(l.icpScore), String(l.emailOpenCount ?? 0), String(l.emailClickCount ?? 0),
        l.createdAt.toISOString(),
      ]),
    )
  } else if (type === 'keywords') {
    const keywords = await prisma.seoKeyword.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
    })
    filename = 'keywords.csv'
    csv = toCsv(
      ['id', 'keyword', 'projectId', 'createdAt'],
      keywords.map((k) => [k.id, k.text, k.projectId ?? '', k.createdAt.toISOString()]),
    )
  } else if (type === 'segments') {
    const segments = await prisma.nurtureSegment.findMany({
      where: { tenantId: tid },
      include: { _count: { select: { leads: true } } },
      orderBy: { createdAt: 'desc' },
    })
    filename = 'segments.csv'
    csv = toCsv(
      ['id', 'name', 'description', 'leadCount', 'projectId', 'createdAt'],
      segments.map((s) => [
        s.id, s.name, s.description ?? '', String(s._count.leads),
        s.projectId ?? '', s.createdAt.toISOString(),
      ]),
    )
  } else {
    return err('不正な type パラメータです', 400)
  }

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
