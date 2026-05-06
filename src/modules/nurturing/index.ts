export type { SegmentCriteria, LeadWithScore, SegmentWithCount } from './types'
export { CreateSegmentSchema, GenerateEmailSchema } from './schemas'
export type { CreateSegmentInput, GenerateEmailInput } from './schemas'

export { syncLeads, listLeads } from './lead-service'
export { listSegments, getSegment, createSegment, deleteSegment, applySegmentCriteria } from './segment-service'
export { generateEmailDraft, generateEmailVariants, listDrafts, getDraft } from './email-service'
