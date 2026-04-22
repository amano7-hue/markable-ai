import { prisma } from '@/lib/db/client'
import type { CreateSegmentInput } from './schemas'
import type { SegmentCriteria, SegmentWithCount } from './types'

export async function listSegments(tenantId: string): Promise<SegmentWithCount[]> {
  const segments = await prisma.nurtureSegment.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { leads: true } } },
  })

  return segments.map((s) => ({
    id: s.id,
    tenantId: s.tenantId,
    name: s.name,
    description: s.description,
    criteria: s.criteria as SegmentCriteria,
    leadCount: s._count.leads,
    createdAt: s.createdAt,
  }))
}

export async function getSegment(tenantId: string, segmentId: string) {
  return prisma.nurtureSegment.findFirst({
    where: { id: segmentId, tenantId },
    include: {
      leads: {
        include: { lead: true },
        orderBy: { lead: { icpScore: 'desc' } },
      },
    },
  })
}

export async function createSegment(tenantId: string, input: CreateSegmentInput) {
  const segment = await prisma.nurtureSegment.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description ?? null,
      criteria: input.criteria,
    },
  })

  await applySegmentCriteria(tenantId, segment.id)
  return segment
}

export async function deleteSegment(tenantId: string, segmentId: string) {
  return prisma.nurtureSegment.delete({
    where: { id: segmentId, tenantId },
  })
}

export async function applySegmentCriteria(tenantId: string, segmentId: string): Promise<number> {
  const segment = await prisma.nurtureSegment.findFirst({
    where: { id: segmentId, tenantId },
  })
  if (!segment) return 0

  const criteria = segment.criteria as SegmentCriteria

  const leads = await prisma.nurtureLead.findMany({
    where: {
      tenantId,
      ...(criteria.lifecycle?.length ? { lifecycle: { in: criteria.lifecycle } } : {}),
      ...(criteria.minIcpScore !== undefined ? { icpScore: { gte: criteria.minIcpScore } } : {}),
      ...(criteria.company ? { company: { contains: criteria.company, mode: 'insensitive' } } : {}),
    },
    select: { id: true },
  })

  // 既存の紐付けをリセットして再適用
  await prisma.nurtureLeadSegment.deleteMany({ where: { segmentId } })
  if (leads.length > 0) {
    await prisma.nurtureLeadSegment.createMany({
      data: leads.map((l) => ({ leadId: l.id, segmentId })),
      skipDuplicates: true,
    })
  }

  return leads.length
}
