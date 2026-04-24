import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/get-auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    gscConnection: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    seoArticle: {
      updateMany: vi.fn(),
    },
    approvalItem: {
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/modules/seo', () => ({
  listKeywords: vi.fn(),
  createKeyword: vi.fn(),
  getKeyword: vi.fn(),
  updateKeyword: vi.fn(),
  deleteKeyword: vi.fn(),
  listArticles: vi.fn(),
  getArticle: vi.fn(),
  generateArticleDraft: vi.fn(),
  syncGscData: vi.fn(),
  getKeywordHistory: vi.fn(),
  getTopOpportunities: vi.fn(),
  CreateKeywordSchema: { safeParse: vi.fn() },
  UpdateKeywordSchema: { safeParse: vi.fn() },
  GenerateArticleSchema: { safeParse: vi.fn() },
}))

vi.mock('@/integrations/gsc', () => ({
  getGscClient: vi.fn(),
}))

import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import * as SeoModule from '@/modules/seo'
import * as GscIntegration from '@/integrations/gsc'

const mockGetAuth = getAuth as ReturnType<typeof vi.fn>
const mockGscConnectionFindUnique = prisma.gscConnection.findUnique as ReturnType<typeof vi.fn>
const mockListKeywords = SeoModule.listKeywords as ReturnType<typeof vi.fn>
const mockCreateKeyword = SeoModule.createKeyword as ReturnType<typeof vi.fn>
const mockGetKeyword = SeoModule.getKeyword as ReturnType<typeof vi.fn>
const mockUpdateKeyword = SeoModule.updateKeyword as ReturnType<typeof vi.fn>
const mockDeleteKeyword = SeoModule.deleteKeyword as ReturnType<typeof vi.fn>
const mockListArticles = SeoModule.listArticles as ReturnType<typeof vi.fn>
const mockGetArticle = SeoModule.getArticle as ReturnType<typeof vi.fn>
const mockGenerateArticleDraft = SeoModule.generateArticleDraft as ReturnType<typeof vi.fn>
const mockSyncGscData = SeoModule.syncGscData as ReturnType<typeof vi.fn>
const mockGetKeywordHistory = SeoModule.getKeywordHistory as ReturnType<typeof vi.fn>
const mockGetTopOpportunities = SeoModule.getTopOpportunities as ReturnType<typeof vi.fn>
const mockGscConnectionUpdate = prisma.gscConnection.update as ReturnType<typeof vi.fn>
const mockSeoArticleUpdateMany = prisma.seoArticle.updateMany as ReturnType<typeof vi.fn>
const mockApprovalItemUpdateMany = prisma.approvalItem.updateMany as ReturnType<typeof vi.fn>
const mockCreateKeywordSchema = SeoModule.CreateKeywordSchema as { safeParse: ReturnType<typeof vi.fn> }
const mockUpdateKeywordSchema = SeoModule.UpdateKeywordSchema as { safeParse: ReturnType<typeof vi.fn> }
const mockGenerateArticleSchema = SeoModule.GenerateArticleSchema as { safeParse: ReturnType<typeof vi.fn> }
const mockGetGscClient = GscIntegration.getGscClient as ReturnType<typeof vi.fn>

function makeCtx(tenantId = 't1', userId = 'u1') {
  return { clerkId: 'clerk1', user: { id: userId }, tenant: { id: tenantId } }
}

function makeRequest(url: string, opts: RequestInit = {}) {
  return new Request(`http://localhost${url}`, opts)
}

beforeEach(() => vi.clearAllMocks())

// ─── GET/POST /api/seo/keywords ───────────────────────────────────────────────

import { GET as keywordsGET, POST as keywordsPOST } from '../keywords/route'

describe('GET /api/seo/keywords', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await keywordsGET()
    expect(res.status).toBe(401)
  })

  it('returns keywords list', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockListKeywords.mockResolvedValue([{ id: 'k1', text: 'SEO tools' }])

    const res = await keywordsGET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('k1')
  })

  it('passes tenantId to listKeywords', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('specific-tenant'))
    mockListKeywords.mockResolvedValue([])

    await keywordsGET()
    expect(mockListKeywords).toHaveBeenCalledWith('specific-tenant')
  })
})

describe('POST /api/seo/keywords', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await keywordsPOST(makeRequest('/api/seo/keywords', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockCreateKeywordSchema.safeParse.mockReturnValue({ success: false, error: { message: 'invalid' } })

    const res = await keywordsPOST(makeRequest('/api/seo/keywords', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('creates keyword and returns 201', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const input = { text: 'SEO tools Japan' }
    mockCreateKeywordSchema.safeParse.mockReturnValue({ success: true, data: input })
    mockCreateKeyword.mockResolvedValue({ id: 'k1', ...input })

    const res = await keywordsPOST(makeRequest('/api/seo/keywords', { method: 'POST', body: JSON.stringify(input) }))
    expect(res.status).toBe(201)
  })
})

// ─── GET/PATCH/DELETE /api/seo/keywords/[keywordId] ───────────────────────────

import { GET as keywordGET, PATCH as keywordPATCH, DELETE as keywordDELETE } from '../keywords/[keywordId]/route'

const params = { params: Promise.resolve({ keywordId: 'k1' }) }

describe('GET /api/seo/keywords/[keywordId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await keywordGET(makeRequest('/api/seo/keywords/k1'), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when keyword not found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetKeyword.mockResolvedValue(null)

    const res = await keywordGET(makeRequest('/api/seo/keywords/k1'), params)
    expect(res.status).toBe(404)
  })

  it('returns keyword when found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetKeyword.mockResolvedValue({ id: 'k1', text: 'SEO' })

    const res = await keywordGET(makeRequest('/api/seo/keywords/k1'), params)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('k1')
  })
})

describe('PATCH /api/seo/keywords/[keywordId]', () => {
  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockUpdateKeywordSchema.safeParse.mockReturnValue({ success: false, error: { message: 'invalid' } })

    const res = await keywordPATCH(makeRequest('/api/seo/keywords/k1', { method: 'PATCH', body: '{}' }), params)
    expect(res.status).toBe(400)
  })

  it('updates keyword successfully', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const input = { isActive: false }
    mockUpdateKeywordSchema.safeParse.mockReturnValue({ success: true, data: input })
    mockUpdateKeyword.mockResolvedValue({ id: 'k1', isActive: false })

    const res = await keywordPATCH(
      makeRequest('/api/seo/keywords/k1', { method: 'PATCH', body: JSON.stringify(input) }),
      params,
    )
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/seo/keywords/[keywordId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await keywordDELETE(makeRequest('/api/seo/keywords/k1'), params)
    expect(res.status).toBe(401)
  })

  it('deletes keyword and returns deleted: true', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockDeleteKeyword.mockResolvedValue(undefined)

    const res = await keywordDELETE(makeRequest('/api/seo/keywords/k1'), params)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.deleted).toBe(true)
  })

  it('scopes delete to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('specific-tenant'))
    mockDeleteKeyword.mockResolvedValue(undefined)

    await keywordDELETE(makeRequest('/api/seo/keywords/k1'), params)
    expect(mockDeleteKeyword).toHaveBeenCalledWith('specific-tenant', 'k1')
  })
})

// ─── POST /api/seo/articles/generate ─────────────────────────────────────────

import { POST as articlesGeneratePOST } from '../articles/generate/route'

describe('POST /api/seo/articles/generate', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await articlesGeneratePOST(makeRequest('/api/seo/articles/generate', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGenerateArticleSchema.safeParse.mockReturnValue({ success: false, error: { message: 'invalid' } })

    const res = await articlesGeneratePOST(makeRequest('/api/seo/articles/generate', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('returns 202 with result', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const input = { keywordId: 'k1', intent: 'informational' }
    const result = { articleId: 'a1', approvalItemId: 'ap1' }
    mockGenerateArticleSchema.safeParse.mockReturnValue({ success: true, data: input })
    mockGenerateArticleDraft.mockResolvedValue(result)

    const res = await articlesGeneratePOST(
      makeRequest('/api/seo/articles/generate', { method: 'POST', body: JSON.stringify(input) }),
    )
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.articleId).toBe('a1')
  })
})

// ─── POST /api/seo/sync ───────────────────────────────────────────────────────

import { POST as seoSyncPOST } from '../sync/route'

describe('POST /api/seo/sync', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await seoSyncPOST()
    expect(res.status).toBe(401)
  })

  it('returns synced count with 202', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGscConnectionFindUnique.mockResolvedValue(null)
    mockGetGscClient.mockResolvedValue({})
    mockSyncGscData.mockResolvedValue(42)

    const res = await seoSyncPOST()
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.synced).toBe(42)
  })

  it('uses mock siteUrl when no connection', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockGscConnectionFindUnique.mockResolvedValue(null)
    mockGetGscClient.mockResolvedValue({})
    mockSyncGscData.mockResolvedValue(0)

    await seoSyncPOST()
    expect(mockSyncGscData).toHaveBeenCalledWith('t1', 'mock', expect.anything(), 30)
  })
})

// ─── GET /api/seo/articles ────────────────────────────────────────────────────

import { GET as articlesGET } from '../articles/route'

describe('GET /api/seo/articles', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await articlesGET(makeRequest('/api/seo/articles'))
    expect(res.status).toBe(401)
  })

  it('returns articles list', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockListArticles.mockResolvedValue([{ id: 'a1', title: 'Test Article' }])

    const res = await articlesGET(makeRequest('/api/seo/articles'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('a1')
  })

  it('passes status filter from query param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockListArticles.mockResolvedValue([])

    await articlesGET(makeRequest('/api/seo/articles?status=APPROVED'))
    expect(mockListArticles).toHaveBeenCalledWith('t1', 'APPROVED')
  })

  it('passes undefined when no status param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockListArticles.mockResolvedValue([])

    await articlesGET(makeRequest('/api/seo/articles'))
    expect(mockListArticles).toHaveBeenCalledWith('t1', undefined)
  })
})

// ─── GET/PATCH /api/seo/articles/[articleId] ──────────────────────────────────

import { GET as articleGET, PATCH as articlePATCH } from '../articles/[articleId]/route'

const articleParams = { params: Promise.resolve({ articleId: 'a1' }) }

describe('GET /api/seo/articles/[articleId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await articleGET(makeRequest('/api/seo/articles/a1'), articleParams)
    expect(res.status).toBe(401)
  })

  it('returns 404 when article not found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetArticle.mockResolvedValue(null)

    const res = await articleGET(makeRequest('/api/seo/articles/a1'), articleParams)
    expect(res.status).toBe(404)
  })

  it('returns article when found', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGetArticle.mockResolvedValue({ id: 'a1', title: 'Test' })

    const res = await articleGET(makeRequest('/api/seo/articles/a1'), articleParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('a1')
  })

  it('scopes query to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t-specific'))
    mockGetArticle.mockResolvedValue(null)

    await articleGET(makeRequest('/api/seo/articles/a1'), articleParams)
    expect(mockGetArticle).toHaveBeenCalledWith('t-specific', 'a1')
  })
})

describe('PATCH /api/seo/articles/[articleId]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await articlePATCH(
      makeRequest('/api/seo/articles/a1', { method: 'PATCH', body: '{"action":"approve"}' }),
      articleParams,
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await articlePATCH(
      makeRequest('/api/seo/articles/a1', { method: 'PATCH', body: '{"action":"invalid"}' }),
      articleParams,
    )
    expect(res.status).toBe(400)
  })

  it('sets status APPROVED for approve action', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockSeoArticleUpdateMany.mockResolvedValue({ count: 1 })

    await articlePATCH(
      makeRequest('/api/seo/articles/a1', { method: 'PATCH', body: '{"action":"approve"}' }),
      articleParams,
    )
    expect(mockSeoArticleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
    )
  })

  it('scopes update to tenantId', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t-specific'))
    mockSeoArticleUpdateMany.mockResolvedValue({ count: 1 })

    await articlePATCH(
      makeRequest('/api/seo/articles/a1', { method: 'PATCH', body: '{"action":"approve"}' }),
      articleParams,
    )
    expect(mockSeoArticleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't-specific' }) }),
    )
  })

  it('also syncs ApprovalItem status for the article', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockSeoArticleUpdateMany.mockResolvedValue({ count: 1 })

    await articlePATCH(
      makeRequest('/api/seo/articles/a1', { method: 'PATCH', body: '{"action":"reject"}' }),
      articleParams,
    )
    expect(mockApprovalItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 't1',
          type: 'seo_article_draft',
          status: 'PENDING',
        }),
        data: expect.objectContaining({ status: 'REJECTED' }),
      }),
    )
  })
})

// ─── GET /api/seo/keywords/[keywordId]/history ────────────────────────────────

import { GET as historyGET } from '../keywords/[keywordId]/history/route'

describe('GET /api/seo/keywords/[keywordId]/history', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await historyGET(makeRequest('/api/seo/keywords/k1/history'), { params: Promise.resolve({ keywordId: 'k1' }) })
    expect(res.status).toBe(401)
  })

  it('returns keyword history', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const history = [{ id: 'h1', position: 5 }]
    mockGetKeywordHistory.mockResolvedValue(history)

    const res = await historyGET(makeRequest('/api/seo/keywords/k1/history'), { params: Promise.resolve({ keywordId: 'k1' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('h1')
  })

  it('passes days param (default 30)', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockGetKeywordHistory.mockResolvedValue([])

    await historyGET(makeRequest('/api/seo/keywords/k1/history'), { params: Promise.resolve({ keywordId: 'k1' }) })
    expect(mockGetKeywordHistory).toHaveBeenCalledWith('t1', 'k1', 30)
  })

  it('parses custom days param', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockGetKeywordHistory.mockResolvedValue([])

    await historyGET(makeRequest('/api/seo/keywords/k1/history?days=7'), { params: Promise.resolve({ keywordId: 'k1' }) })
    expect(mockGetKeywordHistory).toHaveBeenCalledWith('t1', 'k1', 7)
  })
})

// ─── GET /api/seo/opportunities ───────────────────────────────────────────────

import { GET as opportunitiesGET } from '../opportunities/route'

describe('GET /api/seo/opportunities', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await opportunitiesGET()
    expect(res.status).toBe(401)
  })

  it('returns opportunities', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const opps = [{ keyword: 'test', currentPosition: 11 }]
    mockGetTopOpportunities.mockResolvedValue(opps)

    const res = await opportunitiesGET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].keyword).toBe('test')
  })

  it('passes tenantId to getTopOpportunities', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t-specific'))
    mockGetTopOpportunities.mockResolvedValue([])

    await opportunitiesGET()
    expect(mockGetTopOpportunities).toHaveBeenCalledWith('t-specific')
  })
})

// ─── PATCH /api/seo/connect ───────────────────────────────────────────────────

import { PATCH as seoConnectPATCH } from '../connect/route'

describe('PATCH /api/seo/connect', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetAuth.mockResolvedValue(null)
    const res = await seoConnectPATCH(makeRequest('/api/seo/connect', { method: 'PATCH', body: '{"siteUrl":"https://example.com"}' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing siteUrl', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    const res = await seoConnectPATCH(makeRequest('/api/seo/connect', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when no GSC connection exists', async () => {
    mockGetAuth.mockResolvedValue(makeCtx())
    mockGscConnectionFindUnique.mockResolvedValue(null)

    const res = await seoConnectPATCH(makeRequest('/api/seo/connect', { method: 'PATCH', body: '{"siteUrl":"https://example.com"}' }))
    expect(res.status).toBe(404)
  })

  it('updates siteUrl when connection exists', async () => {
    mockGetAuth.mockResolvedValue(makeCtx('t1'))
    mockGscConnectionFindUnique.mockResolvedValue({ id: 'c1' })
    mockGscConnectionUpdate.mockResolvedValue({ siteUrl: 'https://example.com' })

    const res = await seoConnectPATCH(makeRequest('/api/seo/connect', { method: 'PATCH', body: '{"siteUrl":"https://example.com"}' }))
    expect(res.status).toBe(200)
    expect(mockGscConnectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { siteUrl: 'https://example.com' } }),
    )
  })
})
