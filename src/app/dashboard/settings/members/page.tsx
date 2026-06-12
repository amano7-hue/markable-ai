import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import PendingTenantList from './pending-tenant-list'

export const metadata: Metadata = { title: 'メンバー管理' }

export default async function MembersPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')
  if (ctx.user.role !== 'OWNER') redirect('/dashboard/settings')

  const pending = await prisma.pendingTenant.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">メンバー管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          事前登録したメールアドレスのみ、新規アカウント登録が可能です。
        </p>
      </div>
      <PendingTenantList initialList={pending} />
    </div>
  )
}
