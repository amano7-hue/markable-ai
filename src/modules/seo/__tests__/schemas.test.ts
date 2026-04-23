import { describe, it, expect } from 'vitest'
import { CreateKeywordSchema, UpdateKeywordSchema, GenerateArticleSchema } from '../schemas'

describe('CreateKeywordSchema', () => {
  it('accepts valid keyword', () => {
    expect(CreateKeywordSchema.safeParse({ text: 'CRM ツール 比較' }).success).toBe(true)
  })

  it('accepts optional intent', () => {
    expect(
      CreateKeywordSchema.safeParse({ text: 'CRM ツール', intent: 'commercial' }).success,
    ).toBe(true)
  })

  it('rejects text shorter than 2 chars', () => {
    expect(CreateKeywordSchema.safeParse({ text: 'a' }).success).toBe(false)
  })

  it('rejects text longer than 200 chars', () => {
    expect(CreateKeywordSchema.safeParse({ text: 'a'.repeat(201) }).success).toBe(false)
  })

  it('rejects invalid intent value', () => {
    expect(
      CreateKeywordSchema.safeParse({ text: 'keyword', intent: 'transactional' }).success,
    ).toBe(false)
  })

  it('accepts all valid intent values', () => {
    for (const intent of ['informational', 'commercial', 'navigational'] as const) {
      expect(CreateKeywordSchema.safeParse({ text: 'keyword ab', intent }).success).toBe(true)
    }
  })
})

describe('UpdateKeywordSchema', () => {
  it('accepts empty object', () => {
    expect(UpdateKeywordSchema.safeParse({}).success).toBe(true)
  })

  it('accepts isActive toggle', () => {
    expect(UpdateKeywordSchema.safeParse({ isActive: false }).success).toBe(true)
  })

  it('rejects text too short', () => {
    expect(UpdateKeywordSchema.safeParse({ text: 'a' }).success).toBe(false)
  })
})

describe('GenerateArticleSchema', () => {
  it('requires title', () => {
    expect(GenerateArticleSchema.safeParse({}).success).toBe(false)
  })

  it('accepts title without keywordId', () => {
    expect(GenerateArticleSchema.safeParse({ title: 'CRMツールの比較ガイド' }).success).toBe(true)
  })

  it('accepts title with keywordId', () => {
    expect(
      GenerateArticleSchema.safeParse({ title: 'CRMツールの比較ガイド', keywordId: 'kw1' }).success,
    ).toBe(true)
  })

  it('rejects title shorter than 5 chars', () => {
    expect(GenerateArticleSchema.safeParse({ title: 'CRM' }).success).toBe(false)
  })

  it('rejects title longer than 200 chars', () => {
    expect(GenerateArticleSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false)
  })
})
