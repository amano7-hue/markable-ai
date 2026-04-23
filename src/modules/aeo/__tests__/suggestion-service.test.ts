import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockMessagesCreate }
    },
  }
})

vi.mock('@/lib/db/client', () => ({
  prisma: {
    aeoPrompt: { findFirst: vi.fn() },
    approvalItem: { create: vi.fn() },
  },
}))

import { prisma } from '@/lib/db/client'
import { generateAndEnqueueSuggestion } from '../suggestion-service'

const mockPromptFindFirst = prisma.aeoPrompt.findFirst as ReturnType<typeof vi.fn>
const mockApprovalCreate = prisma.approvalItem.create as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateAndEnqueueSuggestion', () => {
  const gaps = [
    {
      engine: 'CHATGPT',
      competitorDomain: 'comp.com',
      competitorRank: 1,
      promptText: 'test',
      promptId: 'p1',
      snapshotDate: new Date(),
    },
  ]

  it('throws when prompt not found', async () => {
    mockPromptFindFirst.mockResolvedValue(null)
    await expect(generateAndEnqueueSuggestion('t1', 'missing-prompt', gaps)).rejects.toThrow(
      'Prompt not found',
    )
    expect(mockApprovalCreate).not.toHaveBeenCalled()
  })

  it('creates approval item and returns its id', async () => {
    mockPromptFindFirst.mockResolvedValue({ id: 'p1', tenantId: 't1', text: 'Best CRM?' })
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'コンテンツを改善してください。' }],
    })
    mockApprovalCreate.mockResolvedValue({ id: 'approval-1' })

    const id = await generateAndEnqueueSuggestion('t1', 'p1', gaps)
    expect(id).toBe('approval-1')
    expect(mockApprovalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          module: 'aeo',
          type: 'aeo_suggestion',
        }),
      }),
    )
  })

  it('payload contains promptId, promptText, gaps, suggestion', async () => {
    mockPromptFindFirst.mockResolvedValue({ id: 'p1', tenantId: 't1', text: 'Best CRM?' })
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'My suggestion text' }],
    })
    mockApprovalCreate.mockResolvedValue({ id: 'approval-1' })

    await generateAndEnqueueSuggestion('t1', 'p1', gaps)

    const callData = mockApprovalCreate.mock.calls[0][0].data
    expect(callData.payload).toMatchObject({
      promptId: 'p1',
      promptText: 'Best CRM?',
      suggestion: 'My suggestion text',
    })
    expect(callData.payload.gaps).toHaveLength(1)
    expect(callData.payload.gaps[0]).toMatchObject({
      engine: 'CHATGPT',
      competitorDomain: 'comp.com',
      competitorRank: 1,
    })
  })

  it('limits gaps to 5 in payload', async () => {
    const manyGaps = Array.from({ length: 8 }, (_, i) => ({
      engine: 'CHATGPT',
      competitorDomain: `comp${i}.com`,
      competitorRank: i + 1,
      promptText: 'q',
      promptId: 'p1',
      snapshotDate: new Date(),
    }))
    mockPromptFindFirst.mockResolvedValue({ id: 'p1', tenantId: 't1', text: 'Best CRM?' })
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'suggestion' }],
    })
    mockApprovalCreate.mockResolvedValue({ id: 'a1' })

    await generateAndEnqueueSuggestion('t1', 'p1', manyGaps)

    const callData = mockApprovalCreate.mock.calls[0][0].data
    expect(callData.payload.gaps).toHaveLength(5)
  })

  it('stores empty string suggestion when LLM returns non-text block', async () => {
    mockPromptFindFirst.mockResolvedValue({ id: 'p1', tenantId: 't1', text: 'Best CRM?' })
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tu1', name: 'fn', input: {} }],
    })
    mockApprovalCreate.mockResolvedValue({ id: 'a1' })

    await generateAndEnqueueSuggestion('t1', 'p1', gaps)

    const callData = mockApprovalCreate.mock.calls[0][0].data
    expect(callData.payload.suggestion).toBe('')
  })

  it('queries prompt with tenantId for security', async () => {
    mockPromptFindFirst.mockResolvedValue(null)
    await generateAndEnqueueSuggestion('t1', 'p1', []).catch(() => {})
    expect(mockPromptFindFirst).toHaveBeenCalledWith({
      where: { id: 'p1', tenantId: 't1' },
    })
  })
})
