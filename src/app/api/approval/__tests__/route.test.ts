import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    approvalItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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
import { GET, PATCH } from '../route'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockFindMany = prisma.approvalItem.findMany as ReturnType<typeof vi.fn>
const mockFindFirst = prisma.approvalItem.findFirst as ReturnType<typeof vi.fn>
const mockUpdateMany = prisma.approvalItem.updateMany as ReturnType<typeof vi.fn>
const mockEmailUpdateMany = prisma.nurtureEmailDraft.updateMany as ReturnType<typeof vi.fn>
const mockArticleUpdateMany = prisma.seoArticle.updateMany as ReturnType<typeof vi.fn>

function makeCtx(tenantId = 't1', userId = 'u1') {
  return { clerkId: 'clerk1', user: { id: userId }, tenant: { id: tenantId } }
}

function makeRequest(url: string, opts: RequestInit = {}) {
  return new Request(`http://localhost${url}`, opts)
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return { id: 'a1', tenantId: 't1', module: 'aeo', type: 'aeo_suggestion', payload: {}, status: 'PENDING', ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEmailUpdateMany.mockResolvedValue({ count: 0 })
  mockArticleUpdateMany.mockResolvedValue({ count: 0 })
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/approval', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await GET(makeRequest('/api/approval'))
    expect(res.status).toBe(401)
  })

  it('returns items scoped to tenant', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    const items = [{ id: 'a1', tenantId: 't1', module: 'seo', status: 'PENDING' }]
    mockFindMany.mockResolvedValue(items)

    const res = await GET(makeRequest('/api/approval'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(items)
  })

  it('passes tenantId to findMany where clause', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('tenant-abc'))
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('/api/approval'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-abc' }) }),
    )
  })

  it('filters by module query param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('/api/approval?module=seo'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ module: 'seo' }) }),
    )
  })

  it('filters by status query param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('/api/approval?status=APPROVED'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'APPROVED' }) }),
    )
  })

  it('omits module/status when not in query', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('/api/approval'))
    const call = mockFindMany.mock.calls[0][0]
    expect('module' in call.where).toBe(false)
    expect('status' in call.where).toBe(false)
  })
})

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/approval', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'invalid' }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockFindFirst.mockResolvedValue(null)

    const res = await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'missing', action: 'approve' }),
      }),
    )
    expect(res.status).toBe(404)
  })

  it('sets status APPROVED for approve action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockFindFirst.mockResolvedValue(makeItem())
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    )
  })

  it('sets status REJECTED for reject action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockFindFirst.mockResolvedValue(makeItem())
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'reject' }),
      }),
    )
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' }),
      }),
    )
  })

  it('scopes updateMany to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t-specific'))
    mockFindFirst.mockResolvedValue(makeItem({ tenantId: 't-specific' }))
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't-specific' }),
      }),
    )
  })

  it('returns ok with updated: true on success', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockFindFirst.mockResolvedValue(makeItem())
    mockUpdateMany.mockResolvedValue({ count: 1 })

    const res = await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.updated).toBe(true)
  })

  it('also updates NurtureEmailDraft when type is nurturing_email_draft', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockFindFirst.mockResolvedValue(
      makeItem({ type: 'nurturing_email_draft', payload: { draftId: 'draft-99' } }),
    )
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(mockEmailUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'draft-99', tenantId: 't1' }),
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    )
  })

  it('also updates SeoArticle when type is seo_article_draft', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockFindFirst.mockResolvedValue(
      makeItem({ type: 'seo_article_draft', payload: { articleId: 'article-42' } }),
    )
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(mockArticleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'article-42', tenantId: 't1' }),
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    )
  })

  it('does not update domain model for aeo_suggestion type', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockFindFirst.mockResolvedValue(makeItem({ type: 'aeo_suggestion', payload: {} }))
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve' }),
      }),
    )
    expect(mockEmailUpdateMany).not.toHaveBeenCalled()
    expect(mockArticleUpdateMany).not.toHaveBeenCalled()
  })

  it('merges edits into payload when edits are provided', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockFindFirst.mockResolvedValue(
      makeItem({ type: 'aeo_suggestion', payload: { suggestion: 'original text' } }),
    )
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'a1', action: 'approve', edits: { suggestion: 'edited text' } }),
      }),
    )
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({ suggestion: 'edited text' }),
        }),
      }),
    )
  })

  it('propagates edits to NurtureEmailDraft when present', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockFindFirst.mockResolvedValue(
      makeItem({ type: 'nurturing_email_draft', payload: { draftId: 'd1', subject: 'old', body: 'old body' } }),
    )
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'a1',
          action: 'approve',
          edits: { subject: 'new subject', body: 'new body' },
        }),
      }),
    )
    expect(mockEmailUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subject: 'new subject', body: 'new body' }),
      }),
    )
  })

  it('propagates edits to SeoArticle when present', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1', 'u1'))
    mockFindFirst.mockResolvedValue(
      makeItem({ type: 'seo_article_draft', payload: { articleId: 'art1', title: 'old', brief: 'old brief' } }),
    )
    mockUpdateMany.mockResolvedValue({ count: 1 })

    await PATCH(
      makeRequest('/api/approval', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'a1',
          action: 'approve',
          edits: { title: 'new title', brief: 'new brief' },
        }),
      }),
    )
    expect(mockArticleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'new title', brief: 'new brief' }),
      }),
    )
  })
})
