import { describe, it, expect } from 'vitest'
import { CreatePromptSchema, UpdatePromptSchema, AddCompetitorSchema } from '../schemas'

describe('CreatePromptSchema', () => {
  it('accepts valid input', () => {
    const result = CreatePromptSchema.safeParse({ text: 'おすすめのCRMツールは？' })
    expect(result.success).toBe(true)
  })

  it('accepts optional industry and competitors', () => {
    const result = CreatePromptSchema.safeParse({
      text: 'おすすめのCRMツールは？',
      industry: 'BtoB SaaS',
      competitors: ['competitor.com'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects text shorter than 5 chars', () => {
    const result = CreatePromptSchema.safeParse({ text: 'abc' })
    expect(result.success).toBe(false)
  })

  it('rejects text longer than 500 chars', () => {
    const result = CreatePromptSchema.safeParse({ text: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 competitors', () => {
    const result = CreatePromptSchema.safeParse({
      text: 'おすすめのCRMツールは？',
      competitors: Array.from({ length: 11 }, (_, i) => `domain${i}.com`),
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdatePromptSchema', () => {
  it('accepts partial update', () => {
    expect(UpdatePromptSchema.safeParse({ isActive: false }).success).toBe(true)
    expect(UpdatePromptSchema.safeParse({ text: 'new text here' }).success).toBe(true)
    expect(UpdatePromptSchema.safeParse({}).success).toBe(true)
  })

  it('rejects text too short', () => {
    expect(UpdatePromptSchema.safeParse({ text: 'ab' }).success).toBe(false)
  })
})

describe('AddCompetitorSchema', () => {
  it('accepts valid domain', () => {
    expect(AddCompetitorSchema.safeParse({ domain: 'competitor.com' }).success).toBe(true)
  })

  it('rejects missing domain', () => {
    expect(AddCompetitorSchema.safeParse({}).success).toBe(false)
  })

  it('rejects domain longer than 253 chars', () => {
    expect(AddCompetitorSchema.safeParse({ domain: 'a'.repeat(254) }).success).toBe(false)
  })
})
