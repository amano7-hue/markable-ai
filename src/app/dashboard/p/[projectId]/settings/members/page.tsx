import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import MembersClient from './members-client'

export const metadata: Metadata = { title: 'メンバー管理' }

export default async function MembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/onboarding')

  const canManage = ctx.user.role !== 'MEMBER'

  const [members, pendingInvites] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    canManage
      ? prisma.projectInvite.findMany({
          where: { projectId, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-lg font-semibold">メンバー管理</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {ctx.project.name} のメンバーを管理します
        </p>
      </div>

      <MembersClient
        projectId={projectId}
        members={members}
        pendingInvites={pendingInvites}
        canManage={canManage}
      />
    </div>
  )
}
