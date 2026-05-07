import { Resend } from 'resend'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { ok, err } from '@/lib/api-response'
import type { ProjectRole } from '@/generated/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

/** GET /api/projects/[projectId]/invites — メンバー一覧 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role === 'MEMBER') return err('Forbidden', 403)

  const [members, pendingInvites] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.projectInvite.findMany({
      where: { projectId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return ok({ members, pendingInvites })
}

/** POST /api/projects/[projectId]/invites — 招待送信 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role === 'MEMBER') return err('Forbidden', 403)

  const body = await req.json()
  const email: string = body.email?.trim().toLowerCase()
  const role: ProjectRole = body.role === 'EDITOR' ? 'EDITOR' : 'VIEWER'

  if (!email || !email.includes('@')) return err('有効なメールアドレスを入力してください')

  // 既に同テナントのユーザーかチェック
  const existingUser = await prisma.user.findFirst({
    where: { email, tenantId: ctx.tenant.id },
  })

  // 既にメンバーならスキップ
  if (existingUser) {
    const alreadyMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: existingUser.id } },
    })
    if (alreadyMember) return err('このユーザーは既にメンバーです')

    // 同テナント内ユーザーは即時追加
    await prisma.projectMember.create({
      data: { projectId, userId: existingUser.id, role },
    })
    return ok({ added: true, email })
  }

  // 有効な招待が既に存在するかチェック
  const existing = await prisma.projectInvite.findFirst({
    where: { projectId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
  })
  if (existing) return err('このメールアドレスには既に招待を送信済みです')

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日

  const invite = await prisma.projectInvite.create({
    data: { projectId, tenantId: ctx.tenant.id, email, role, expiresAt },
  })

  // メール送信
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`
  const fromEmail = ctx.tenant.resendFrom ?? 'noreply@markable.ai'

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: `${ctx.user.name ?? ctx.user.email} さんから「${ctx.project.name}」への招待が届いています`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">
          Markable AI プロジェクトへの招待
        </h2>
        <p style="color: #444; line-height: 1.6;">
          <strong>${ctx.user.name ?? ctx.user.email}</strong> さんから
          <strong>${ctx.project.name}</strong> への招待が届いています。
        </p>
        <p style="margin: 24px 0;">
          <a href="${inviteUrl}"
             style="background: #0E5EC0; color: white; padding: 12px 24px;
                    border-radius: 4px; text-decoration: none; font-size: 14px;">
            招待を受け入れる
          </a>
        </p>
        <p style="color: #888; font-size: 12px;">
          このリンクは7日間有効です。心当たりがない場合は無視してください。
        </p>
      </div>
    `,
  })

  return ok({ sent: true, email })
}
