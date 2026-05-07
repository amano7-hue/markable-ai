import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { prisma } from '@/lib/db/client'
import AcceptButton from './accept-button'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: {
      project: { select: { id: true, name: true, ownDomain: true } },
      tenant: { select: { name: true } },
    },
  })

  // 無効トークン
  if (!invite) {
    return <InvalidInvite message="招待リンクが無効です。" />
  }
  if (invite.acceptedAt) {
    return <InvalidInvite message="この招待は既に使用されています。" />
  }
  if (invite.expiresAt < new Date()) {
    return <InvalidInvite message="招待の有効期限が切れています。" />
  }

  const { userId } = await auth()

  // 未ログイン → サインイン/サインアップへ (戻り先をこのページに)
  if (!userId) {
    const callbackUrl = encodeURIComponent(`/invite/${token}`)
    redirect(`/sign-in?redirect_url=${callbackUrl}`)
  }

  const roleLabel = invite.role === 'EDITOR' ? '編集者' : '閲覧者'

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md bg-white rounded border border-border p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Image src="/logo-mark.svg" alt="Markable AI" width={32} height={32} />
          <span className="text-base font-semibold tracking-tight text-zinc-900">
            Markable <span className="text-[#0E5EC0]">AI</span>
          </span>
        </div>

        <div>
          <h1 className="text-xl font-semibold text-zinc-900">プロジェクトへ招待されました</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            以下のプロジェクトに <strong>{roleLabel}</strong> として参加できます。
          </p>
        </div>

        <div className="rounded border border-border bg-muted/30 px-4 py-3 space-y-1">
          <p className="text-xs text-muted-foreground">プロジェクト</p>
          <p className="font-medium text-sm">{invite.project.name}</p>
          {invite.project.ownDomain && (
            <p className="text-xs text-muted-foreground">{invite.project.ownDomain}</p>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          招待元: {invite.tenant.name}
        </div>

        <AcceptButton token={token} projectId={invite.project.id} />
      </div>
    </main>
  )
}

function InvalidInvite({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md bg-white rounded border border-border p-8 text-center space-y-4">
        <Image src="/logo-mark.svg" alt="Markable AI" width={32} height={32} className="mx-auto" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center rounded border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          ダッシュボードへ
        </a>
      </div>
    </main>
  )
}
