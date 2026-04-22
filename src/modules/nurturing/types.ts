export interface SegmentCriteria {
  lifecycle?: string[]
  minIcpScore?: number
  company?: string
}

export interface LeadWithScore {
  id: string
  tenantId: string
  hubspotId: string
  email: string
  firstName: string | null
  lastName: string | null
  company: string | null
  jobTitle: string | null
  lifecycle: string | null
  leadStatus: string | null
  icpScore: number
  lastSyncedAt: Date
}

export interface SegmentWithCount {
  id: string
  tenantId: string
  name: string
  description: string | null
  criteria: SegmentCriteria
  leadCount: number
  createdAt: Date
}
