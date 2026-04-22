import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import OnboardingForm from './onboarding-form'

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
        <h1 className="text-2xl font-semibold text-zinc-900">ようこそ、Markeble AIへ</h1>
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
