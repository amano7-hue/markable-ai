import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/auth/get-auth'
import SegmentForm from './segment-form'

export default async function NewSegmentPage() {
  const ctx = await getAuth()
  if (!ctx) redirect('/onboarding')

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">セグメント作成</h1>
      <SegmentForm />
    </div>
  )
}
