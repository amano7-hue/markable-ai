import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate }
  },
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    seoKeyword: { findFirst: vi.fn() },
    seoArticle: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    approvalItem: { create: vi.fn() },
  },
}))

import { prisma } from '@/lib/db/client'
import { generateArticleDraft, listArticles, getArticle } from '../article-service'

const mockKeywordFindFirst = prisma.seoKeyword.findFirst as ReturnType<typeof vi.fn>
const mockArticleCreate = prisma.seoArticle.create as ReturnType<typeof vi.fn>
const mockArticleFindMany = prisma.seoArticle.findMany as ReturnType<typeof vi.fn>
const mockArticleFindFirst = prisma.seoArticle.findFirst as ReturnType<typeof vi.fn>
const mockApprovalCreate = prisma.approvalItem.create as ReturnType<typeof vi.fn>

function makeLlmResponse(text: string) {
  return { content: [{ type: 'text', text }] }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockArticleCreate.mockResolvedValue({ id: 'article-1' })
  mockApprovalCreate.mockResolvedValue({ id: 'approval-1' })
  mockMessagesCreate
    .mockResolvedValueOnce(makeLlmResponse('Brief content here.'))
    .mockResolvedValueOnce(makeLlmResponse('## Draft content\n\nMain body.'))
})

describe('generateArticleDraft', () => {
  it('returns articleId and approvalItemId', async () => {
    const result = await generateArticleDraft('t1', { title: 'SEO Guide' })
    expect(result.articleId).toBe('article-1')
    expect(result.approvalItemId).toBe('approval-1')
  })

  it('creates article with tenantId and title', async () => {
    await generateArticleDraft('t1', { title: 'SEO Guide' })
    expect(mockArticleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          title: 'SEO Guide',
        }),
      }),
    )
  })

  it('creates approval item with module=seo and type=seo_article_draft', async () => {
    await generateArticleDraft('t1', { title: 'SEO Guide' })
    expect(mockApprovalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          module: 'seo',
          type: 'seo_article_draft',
        }),
      }),
    )
  })

  it('resolves keywordId to keywordText when keywordId provided', async () => {
    mockKeywordFindFirst.mockResolvedValue({ text: 'marketing automation' })
    await generateArticleDraft('t1', { title: 'My Title', keywordId: 'kw1' })

    const approvalPayload = mockApprovalCreate.mock.calls[0][0].data.payload
    expect(approvalPayload.keywordText).toBe('marketing automation')
    expect(approvalPayload.keywordId).toBe('kw1')
  })

  it('leaves keywordText null when no keywordId', async () => {
    await generateArticleDraft('t1', { title: 'No Keyword' })
    const approvalPayload = mockApprovalCreate.mock.calls[0][0].data.payload
    expect(approvalPayload.keywordText).toBeNull()
    expect(approvalPayload.keywordId).toBeNull()
  })

  it('looks up keyword scoped by tenantId', async () => {
    mockKeywordFindFirst.mockResolvedValue({ text: 'test' })
    await generateArticleDraft('t1', { title: 'T', keywordId: 'kw99' })
    expect(mockKeywordFindFirst).toHaveBeenCalledWith({
      where: { id: 'kw99', tenantId: 't1' },
      select: { text: true },
    })
  })

  it('calls LLM twice (brief then draft)', async () => {
    await generateArticleDraft('t1', { title: 'Test' })
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)
  })

  it('payload includes brief and draft from LLM', async () => {
    await generateArticleDraft('t1', { title: 'Test' })
    const payload = mockApprovalCreate.mock.calls[0][0].data.payload
    expect(payload.brief).toBe('Brief content here.')
    expect(payload.draft).toContain('Draft content')
  })
})

describe('listArticles', () => {
  it('returns articles without status filter', async () => {
    const articles = [{ id: 'a1', title: 'Test' }]
    mockArticleFindMany.mockResolvedValue(articles)
    const result = await listArticles('t1')
    expect(result).toEqual(articles)
    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    )
  })

  it('passes status filter when provided', async () => {
    mockArticleFindMany.mockResolvedValue([])
    await listArticles('t1', 'PENDING')
    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1', status: 'PENDING' },
      }),
    )
  })
})

describe('getArticle', () => {
  it('queries with id and tenantId', async () => {
    mockArticleFindFirst.mockResolvedValue(null)
    await getArticle('t1', 'article-99')
    expect(mockArticleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'article-99', tenantId: 't1' },
      }),
    )
  })
})
