import { describe, it, expect } from 'vitest'
import { CreateSegmentSchema, GenerateEmailSchema } from '../schemas'

describe('CreateSegmentSchema', () => {
  it('accepts minimal valid input', () => {
    expect(CreateSegmentSchema.safeParse({ name: 'High ICP', criteria: {} }).success).toBe(true)
  })

  it('accepts full criteria', () => {
    const result = CreateSegmentSchema.safeParse({
      name: 'MQL with high ICP',
      description: 'Sales-ready leads',
      criteria: {
        lifecycle: ['marketingqualifiedlead', 'salesqualifiedlead'],
        minIcpScore: 50,
        company: '株式会社',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(CreateSegmentSchema.safeParse({ name: '', criteria: {} }).success).toBe(false)
  })

  it('rejects name longer than 100 chars', () => {
    expect(CreateSegmentSchema.safeParse({ name: 'a'.repeat(101), criteria: {} }).success).toBe(
      false,
    )
  })

  it('rejects minIcpScore out of range', () => {
    expect(
      CreateSegmentSchema.safeParse({ name: 'test', criteria: { minIcpScore: 101 } }).success,
    ).toBe(false)
    expect(
      CreateSegmentSchema.safeParse({ name: 'test', criteria: { minIcpScore: -1 } }).success,
    ).toBe(false)
  })

  it('accepts minIcpScore boundary values', () => {
    expect(
      CreateSegmentSchema.safeParse({ name: 'test', criteria: { minIcpScore: 0 } }).success,
    ).toBe(true)
    expect(
      CreateSegmentSchema.safeParse({ name: 'test', criteria: { minIcpScore: 100 } }).success,
    ).toBe(true)
  })
})

describe('GenerateEmailSchema', () => {
  it('accepts valid input', () => {
    expect(
      GenerateEmailSchema.safeParse({ segmentId: 'seg1', goal: '初回接触' }).success,
    ).toBe(true)
  })

  it('rejects missing segmentId', () => {
    expect(GenerateEmailSchema.safeParse({ goal: '初回接触' }).success).toBe(false)
  })

  it('rejects empty goal', () => {
    expect(GenerateEmailSchema.safeParse({ segmentId: 'seg1', goal: '' }).success).toBe(false)
  })

  it('rejects goal longer than 100 chars', () => {
    expect(
      GenerateEmailSchema.safeParse({ segmentId: 'seg1', goal: 'a'.repeat(101) }).success,
    ).toBe(false)
  })
})
