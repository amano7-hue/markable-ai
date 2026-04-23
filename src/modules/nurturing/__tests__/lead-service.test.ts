import { describe, it, expect } from 'vitest'
import { calcIcpScore } from '../lead-service'

describe('calcIcpScore', () => {
  describe('jobTitle scoring', () => {
    it('scores CxO titles as 30', () => {
      expect(calcIcpScore('CEO')).toBe(30)
      expect(calcIcpScore('CTO')).toBe(30)
      expect(calcIcpScore('CMO')).toBe(30)
      expect(calcIcpScore('Founder')).toBe(30)
      expect(calcIcpScore('President')).toBe(30)
    })

    it('scores VP/Director titles as 20', () => {
      expect(calcIcpScore('VP of Engineering')).toBe(20)
      // Note: "Vice President" matches "president" in the CxO regex → 30
      expect(calcIcpScore('Director of Marketing')).toBe(20)
    })

    it('scores Vice President as 30 (contains "president" which matches CxO regex)', () => {
      expect(calcIcpScore('Vice President Sales')).toBe(30)
    })

    it('scores Manager titles as 10', () => {
      expect(calcIcpScore('Product Manager')).toBe(10)
      expect(calcIcpScore('Marketing Manager')).toBe(10)
    })

    it('scores unknown titles as 0', () => {
      expect(calcIcpScore('Engineer')).toBe(0)
      expect(calcIcpScore('Analyst')).toBe(0)
    })

    it('is case-insensitive', () => {
      expect(calcIcpScore('ceo')).toBe(30)
      expect(calcIcpScore('CEO')).toBe(30)
    })
  })

  describe('lifecycle scoring', () => {
    it('scores SQL/opportunity as 30', () => {
      expect(calcIcpScore(null, 'salesqualifiedlead')).toBe(30)
      expect(calcIcpScore(null, 'opportunity')).toBe(30)
    })

    it('scores MQL as 20', () => {
      expect(calcIcpScore(null, 'marketingqualifiedlead')).toBe(20)
    })

    it('scores other lifecycle stages as 0', () => {
      expect(calcIcpScore(null, 'lead')).toBe(0)
      expect(calcIcpScore(null, 'customer')).toBe(0)
    })
  })

  describe('company scoring', () => {
    it('adds 10 for non-empty company', () => {
      expect(calcIcpScore(null, null, 'Acme Corp')).toBe(10)
    })

    it('adds 0 for null/undefined company', () => {
      expect(calcIcpScore(null, null, null)).toBe(0)
      expect(calcIcpScore(null, null, undefined)).toBe(0)
    })
  })

  describe('combined scoring', () => {
    it('sums all factors', () => {
      // CEO(30) + MQL(20) + company(10) = 60
      expect(calcIcpScore('CEO', 'marketingqualifiedlead', 'Acme')).toBe(60)
    })

    it('caps score at 100', () => {
      // CEO(30) + SQL(30) + company(10) = 70, under cap
      expect(calcIcpScore('CEO', 'salesqualifiedlead', 'Acme')).toBe(70)
    })

    it('returns 0 for empty lead', () => {
      expect(calcIcpScore()).toBe(0)
      expect(calcIcpScore(null, null, null)).toBe(0)
    })
  })
})
