import type { Metadata } from 'next'
import Image from 'next/image'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import OnboardingForm from './onboarding-form'

export const metadata: Metadata = { title: 'ワークスペースを作成' }

export default async function OnboardingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // すでにテナント登録済みならダッシュボードへ
  const ctx = await getAuth()
  if (ctx) redirect('/dashboard')

  const clerkUser = await currentUser()

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
        <div className="mb-6 flex items-center gap-3">
          <Image src="/logo-mark.svg" alt="Markable AI" width={36} height={36} />
          <span className="text-xl font-semibold tracking-tight text-zinc-900">
            Markable <span className="text-[#0E5EC0]">AI</span>
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">ワークスペースを作成</h1>
        <p className="mt-2 text-sm text-zinc-500">
          会社名を入力して、ワークスペースを作成してください。
        </p>
        <OnboardingForm
          clerkId={userId}
          email={clerkUser?.emailAddresses[0]?.emailAddress ?? ''}
          userName={clerkUser?.fullName ?? undefined}
        />
      </div>
    </main>
  )
}
