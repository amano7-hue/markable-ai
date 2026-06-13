import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuth, getProjectAuth } from '@/lib/auth/get-auth'
import SegmentForm from './segment-form'

export const metadata: Metadata = { title: 'セグメント作成 — ナーチャリング' }

type Props = { params?: Promise<{ projectId?: string }> }

export default async function NewSegmentPage({ params }: Props) {
  const { projectId } = (await params) ?? {}
  const ctx = projectId ? await getProjectAuth(projectId) : await getAuth()
  if (!ctx) redirect('/onboarding')
  const basePath = projectId ? `/dashboard/p/${projectId}/nurturing` : '/dashboard/nurturing'

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">セグメント作成</h1>
      <SegmentForm projectId={projectId} basePath={basePath} />
    </div>
  )
}
