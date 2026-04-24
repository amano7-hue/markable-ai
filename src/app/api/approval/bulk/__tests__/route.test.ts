import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    approvalItem: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    nurtureEmailDraft: {
      updateMany: vi.fn(),
    },
    seoArticle: {
      updateMany: vi.fn(),
    },
  },
}))

import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { POST } from '../route'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockFindMany = prisma.approvalItem.findMany as ReturnType<typeof vi.fn>
const mockUpdateMany = prisma.approvalItem.updateMany as ReturnType<typeof vi.fn>
const mockEmailUpdateMany = prisma.nurtureEmailDraft.updateMany as ReturnType<typeof vi.fn>
const mockArticleUpdateMany = prisma.seoArticle.updateMany as ReturnType<typeof vi.fn>

function makeCtx(tenantId = 't1', userId = 'u1') {
  return { clerkId: 'clerk1', user: { id: userId }, tenant: { id: tenantId } }
}

function makeRequest(body: object) {
  return new Request('http://localhost/api/approval/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindMany.mockResolvedValue([])
  mockUpdateMany.mockResolvedValue({ count: 0 })
  mockEmailUpdateMany.mockResolvedValue({ count: 0 })
  mockArticleUpdateMany.mockResolvedValue({ count: 0 })
})

describe('POST /api/approval/bulk', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await POST(makeRequest({ action: 'approve' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await POST(makeRequest({ action: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('bulk approves all pending when no ids/module given', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockFindMany.mockResolvedValue([])
    mockUpdateMany.mockResolvedValue({ count: 5 })

    const res = await POST(makeRequest({ action: 'approve' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.updated).toBe(5)
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', status: 'PENDING' }),
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    )
  })

  it('bulk rejects with module filter', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdateMany.mockResolvedValue({ count: 3 })

    const res = await POST(makeRequest({ action: 'reject', module: 'aeo' }))
    expect(res.status).toBe(200)
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ module: 'aeo', status: 'PENDING' }),
        data: expect.objectContaining({ status: 'REJECTED' }),
      }),
    )
  })

  it('updates only specified ids when ids provided', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdateMany.mockResolvedValue({ count: 2 })

    await POST(makeRequest({ action: 'approve', ids: ['id1', 'id2'] }))
    const callArgs = mockUpdateMany.mock.calls[0][0]
    expect(callArgs.where.id).toEqual({ in: ['id1', 'id2'] })
  })

  it('does not include id filter when ids is empty array', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    await POST(makeRequest({ action: 'approve', ids: [] }))
    const callArgs = mockUpdateMany.mock.calls[0][0]
    expect(callArgs.where.id).toBeUndefined()
  })

  it('sets reviewedAt and reviewedBy', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'user-99'))
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await POST(makeRequest({ action: 'approve' }))
    const callArgs = mockUpdateMany.mock.calls[0][0]
    expect(callArgs.data.reviewedAt).toBeInstanceOf(Date)
    expect(callArgs.data.reviewedBy).toBe('user-99')
  })

  it('returns 0 count when nothing pending', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const res = await POST(makeRequest({ action: 'approve' }))
    const data = await res.json()
    expect(data.updated).toBe(0)
  })

  it('also updates NurtureEmailDraft for matching items', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockFindMany.mockResolvedValue([
      { type: 'nurturing_email_draft', payload: { draftId: 'd1' } },
      { type: 'nurturing_email_draft', payload: { draftId: 'd2' } },
    ])
    mockUpdateMany.mockResolvedValue({ count: 2 })

    await POST(makeRequest({ action: 'approve' }))
    expect(mockEmailUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', id: { in: ['d1', 'd2'] } }),
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    )
  })

  it('also updates SeoArticle for matching items', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockFindMany.mockResolvedValue([
      { type: 'seo_article_draft', payload: { articleId: 'art-1' } },
    ])
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await POST(makeRequest({ action: 'reject' }))
    expect(mockArticleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', id: { in: ['art-1'] } }),
        data: expect.objectContaining({ status: 'REJECTED' }),
      }),
    )
  })

  it('does not call domain updateMany when no matching items', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockFindMany.mockResolvedValue([{ type: 'aeo_suggestion', payload: {} }])
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await POST(makeRequest({ action: 'approve' }))
    expect(mockEmailUpdateMany).not.toHaveBeenCalled()
    expect(mockArticleUpdateMany).not.toHaveBeenCalled()
  })
})
