import { redirect } from 'next/navigation'
import { getProjectAuth } from '@/lib/auth/get-auth'
import { ProjectProvider } from '@/lib/project/context'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const ctx = await getProjectAuth(projectId)
  if (!ctx) redirect('/dashboard')

  return (
    <ProjectProvider project={{
      id: ctx.project.id,
      name: ctx.project.name,
      slug: ctx.project.slug,
      ownDomain: ctx.project.ownDomain,
    }}>
      {children}
    </ProjectProvider>
  )
}
